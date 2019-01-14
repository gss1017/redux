/**
 * @param {any} obj The object to inspect.
 * @returns {boolean} True if the argument appears to be a plain object.
 */
export default function isPlainObject(obj) {
  // obj 不是 object 返回 false
  if (typeof obj !== 'object' || obj === null) return false

  let proto = obj
  // getPrototypeOf 获取当前对象原型链指向的对象
  // proto 的原型等于 null 循环终止
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }

  return Object.getPrototypeOf(obj) === proto // 如果返回结果为 true 则 obj 只有一层原型链
}
