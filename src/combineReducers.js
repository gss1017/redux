import ActionTypes from './utils/actionTypes'
import warning from './utils/warning'
import isPlainObject from './utils/isPlainObject'

function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type
  const actionDescription =
    (actionType && `action "${String(actionType)}"`) || 'an action'

  return (
    `Given ${actionDescription}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  )
}

function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  const reducerKeys = Object.keys(reducers)
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? 'preloadedState argument passed to createStore'
      : 'previous state received by the reducer'

  if (reducerKeys.length === 0) {
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    )
  }

  if (!isPlainObject(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }
  // 判断 state 中的key 与 reducers 中的 key 是否一致
  const unexpectedKeys = Object.keys(inputState).filter(
    key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  )

  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })

  if (action && action.type === ActionTypes.REPLACE) return

  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}

function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(key => {
    const reducer = reducers[key] // 将reducers中的 reducer 逐一取出
    const initialState = reducer(undefined, { type: ActionTypes.INIT })
    // reducer 必须赋一个初值
    if (typeof initialState === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
          `If the state passed to the reducer is undefined, you must ` +
          `explicitly return the initial state. The initial state may ` +
          `not be undefined. If you don't want to set a value for this reducer, ` +
          `you can use null instead of undefined.`
      )
    }

   // 对于未知的action, reducer 必须返回一个有意义的值 默认返回上一次的state
    if (
      typeof reducer(undefined, {
        type: ActionTypes.PROBE_UNKNOWN_ACTION()
      }) === 'undefined'
    ) {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
          `Don't try to handle ${
            ActionTypes.INIT
          } or other actions in "redux/*" ` +
          `namespace. They are considered private. Instead, you must return the ` +
          `current state for any unknown actions, unless it is undefined, ` +
          `in which case you must return the initial state, regardless of the ` +
          `action type. The initial state may not be undefined, but can be null.`
      )
    }
  })
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
// 传入一个包含 reducer 的对象
export default function combineReducers(reducers) {
  // 获取该对象的key
  const reducerKeys = Object.keys(reducers)
  const finalReducers = {}
  for (let i = 0; i < reducerKeys.length; i++) { // 遍历reducerKeys
    const key = reducerKeys[i] // 取出当前的 key 值

    if (process.env.NODE_ENV !== 'production') { // 非生产环境
      if (typeof reducers[key] === 'undefined') { // 对象中的reducer必须定义
        warning(`No reducer provided for key "${key}"`)
      }
    }

    if (typeof reducers[key] === 'function') { // reducer 是函数
      finalReducers[key] = reducers[key] // 将其保存到 finalReducers
    }
  }
  // 以上步骤是将 reducers 中的属性 浅拷贝 到 finalReducers
  // finalReducers 装有 reducer 函数的对象
  const finalReducerKeys = Object.keys(finalReducers) // 取出finalReducers 中的key

  let unexpectedKeyCache
  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {}
  }

  let shapeAssertionError
  try {
    // 检测 reducer 默认返回的是否是 undefined
    assertReducerShape(finalReducers)
  } catch (e) { // 返回 undefined
    shapeAssertionError = e
  }

  return function combination(state = {}, action) { // createStore 中会保存每一次返回的 state
    if (shapeAssertionError) {
      throw shapeAssertionError // reducer 内部返回 undefined 会抛出异常
    }

    if (process.env.NODE_ENV !== 'production') {
      const warningMessage = getUnexpectedStateShapeWarningMessage(
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      )
      if (warningMessage) {
        warning(warningMessage)
      }
    }

    let hasChanged = false
    const nextState = {}
    for (let i = 0; i < finalReducerKeys.length; i++) {
      const key = finalReducerKeys[i] // 取出 finalReducerKeys 的 key
      const reducer = finalReducers[key] // 获取 reducer
      const previousStateForKey = state[key] // 获取上一次 state 中 key的值 保存起来 首次undefined
      const nextStateForKey = reducer(previousStateForKey, action) // 获取 reducer 中 state
      if (typeof nextStateForKey === 'undefined') { // reducer 返回的state 为 undefined 就会抛出异常
        const errorMessage = getUndefinedStateErrorMessage(key, action) // 对应的 action 返回的是 undefined
        throw new Error(errorMessage)
      }
      nextState[key] = nextStateForKey // 将本次 reducer 返回的状态保存起来
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey // 循环中 两次返回的对象只要有一次不同 hasChanged 就为true
    }
    return hasChanged ? nextState : state
  }
}
