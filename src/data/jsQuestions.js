export const JS_QUESTIONS = [
  {
    id: 'js-01',
    question: 'typeof 123',
    answers: ['"string"', '"number"', '"boolean"', '"object"'],
    correctIndex: 1,
    reward: 'speed_boost'
  },
  {
    id: 'js-02',
    question: 'let x = 5;\nx++;\nconsole.log(x);',
    answers: ['4', '5', '6', 'undefined'],
    correctIndex: 2,
    reward: 'extra_balloon'
  },
  {
    id: 'js-03',
    question: 'Toán tử nào so sánh cả giá trị và kiểu dữ liệu trong JavaScript?',
    answers: ['=', '==', '===', '!='],
    correctIndex: 2,
    reward: 'explosion_range'
  },
  {
    id: 'js-04',
    question: 'Phương thức nào thêm một phần tử vào cuối mảng?',
    answers: ['push()', 'pop()', 'shift()', 'slice()'],
    correctIndex: 0,
    reward: 'speed_boost'
  },
  {
    id: 'js-05',
    question: 'Phương thức nào xóa phần tử cuối cùng của mảng?',
    answers: ['push()', 'pop()', 'unshift()', 'map()'],
    correctIndex: 1,
    reward: 'extra_balloon'
  },
  {
    id: 'js-06',
    question: 'Từ khóa nào khai báo một biến không thể gán lại?',
    answers: ['var', 'let', 'const', 'function'],
    correctIndex: 2,
    reward: 'explosion_range'
  },
  {
    id: 'js-07',
    question: 'Vòng lặp nào thường được dùng để duyệt trực tiếp các giá trị trong một mảng?',
    answers: ['for...of', 'for...in', 'while...in', 'switch'],
    correctIndex: 0,
    reward: 'speed_boost'
  },
  {
    id: 'js-08',
    question: 'Array.isArray([])',
    answers: ['true', 'false', 'undefined', 'Error'],
    correctIndex: 0,
    reward: 'extra_balloon'
  },
  {
    id: 'js-09',
    question: 'function add(a, b) {\n  return a + b;\n}\n\nadd(2, 3);',
    answers: ['23', '5', 'undefined', 'Error'],
    correctIndex: 1,
    reward: 'explosion_range'
  },
  {
    id: 'js-10',
    question: 'JSON.stringify() dùng để làm gì?',
    answers: ['Chuyển chuỗi JSON thành Object', 'Chuyển Object thành chuỗi JSON', 'Xóa Object', 'Sao chép một Array'],
    correctIndex: 1,
    reward: 'speed_boost'
  }
];
