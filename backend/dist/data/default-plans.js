"use strict";
/**
 * Pre-generated fallback plans returned when Gemini quota is exhausted.
 * Used as last resort — Gemini parser is always tried first.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PYTHON_PLAN = exports.DEFAULT_JS_PLAN = void 0;
exports.getDefaultPlan = getDefaultPlan;
exports.DEFAULT_JS_PLAN = {
    title: 'JavaScript Fundamentals (Default Plan)',
    total_duration_minutes: 450,
    checkpoints: [
        {
            day: 1, title: 'Variables and Data Types',
            concepts: ['var', 'let', 'const', 'typeof', 'string', 'number', 'boolean'],
            task1: { title: 'Watch: Variables explained', description: 'Learn how to declare and use variables in JavaScript.', duration_minutes: 10 },
            task2: { title: 'Exercise: Declare 5 variables', description: 'Create variables of different types and log them.', duration_minutes: 5 },
            practice: { title: 'Fix the broken variables', description: 'Debug a script with incorrect variable declarations.', difficulty: 'beginner', starter_code: 'var name = "Alice";\nconst age == 25;\nlet isActive = true;\nconsole.log(name, age, isActive);', test_cases: ['Output should include: Alice', 'Output should include: 25'] },
        },
        {
            day: 2, title: 'Conditionals and Comparisons',
            concepts: ['if', 'else', 'else if', '===', '!==', '>', '<'],
            task1: { title: 'Watch: If-else explained', description: 'Understand how conditional logic works.', duration_minutes: 10 },
            task2: { title: 'Exercise: Grade checker', description: 'Write a function that returns A/B/C/F for a score.', duration_minutes: 5 },
            practice: { title: 'FizzBuzz lite', description: 'Print Fizz for multiples of 3, Buzz for multiples of 5.', difficulty: 'beginner', starter_code: 'for (let i = 1; i <= 15; i++) {\n  // your code here\n}', test_cases: ['Output for 3 is Fizz', 'Output for 5 is Buzz', 'Output for 15 is FizzBuzz'] },
        },
        {
            day: 3, title: 'Functions',
            concepts: ['function', 'parameters', 'return', 'arrow functions'],
            task1: { title: 'Watch: Functions explained', description: 'Learn function declarations vs arrow functions.', duration_minutes: 10 },
            task2: { title: 'Exercise: Write 3 functions', description: 'Write add, subtract, and multiply functions.', duration_minutes: 5 },
            practice: { title: 'Calculator function', description: 'Build a function that takes two numbers and an operator and returns the result.', difficulty: 'beginner', starter_code: 'function calculate(a, b, op) {\n  // your code here\n}', test_cases: ['calculate(4, 2, "+") === 6', 'calculate(4, 2, "*") === 8'] },
        },
        {
            day: 4, title: 'Arrays',
            concepts: ['push', 'pop', 'map', 'filter', 'length'],
            task1: { title: 'Watch: Arrays explained', description: 'Core array methods and iteration.', duration_minutes: 10 },
            task2: { title: 'Exercise: Array manipulation', description: 'Create an array and use push, pop, and length.', duration_minutes: 5 },
            practice: { title: 'Filter even numbers', description: 'Return only even numbers from an array.', difficulty: 'beginner', starter_code: 'function filterEvens(arr) {\n  // your code here\n}', test_cases: ['filterEvens([1,2,3,4]) returns [2,4]'] },
        },
        {
            day: 5, title: 'Objects',
            concepts: ['object literal', 'properties', 'methods', 'this', 'dot notation'],
            task1: { title: 'Watch: Objects explained', description: 'Creating and using JavaScript objects.', duration_minutes: 10 },
            task2: { title: 'Exercise: Create a user object', description: 'Build an object with name, age, and a greet() method.', duration_minutes: 5 },
            practice: { title: 'Object property reader', description: 'Write a function that takes an object and a key, returns the value.', difficulty: 'beginner', starter_code: 'function getProperty(obj, key) {\n  // your code here\n}', test_cases: ['getProperty({name:"Alice"}, "name") === "Alice"'] },
        },
    ],
};
exports.DEFAULT_PYTHON_PLAN = {
    title: 'Python Fundamentals (Default Plan)',
    total_duration_minutes: 450,
    checkpoints: [
        {
            day: 1, title: 'Variables and Data Types',
            concepts: ['int', 'str', 'float', 'bool', 'type()'],
            task1: { title: 'Watch: Python variables', description: 'Learn Python\'s dynamic typing system.', duration_minutes: 10 },
            task2: { title: 'Exercise: Declare variables', description: 'Create variables of different types and print them.', duration_minutes: 5 },
            practice: { title: 'Fix the type errors', description: 'Debug a Python script with type conversion bugs.', difficulty: 'beginner', starter_code: 'name = "Alice"\nage = "25"\nprint("Age in 5 years:", age + 5)', test_cases: ['Should print: Age in 5 years: 30'] },
        },
        {
            day: 2, title: 'Conditionals',
            concepts: ['if', 'elif', 'else', 'and', 'or', 'not'],
            task1: { title: 'Watch: Python conditionals', description: 'Python\'s if/elif/else syntax.', duration_minutes: 10 },
            task2: { title: 'Exercise: Grade checker', description: 'Write a grade classifier using if/elif.', duration_minutes: 5 },
            practice: { title: 'Temperature classifier', description: 'Print "hot", "warm", or "cold" based on temperature input.', difficulty: 'beginner', starter_code: 'def classify_temp(temp):\n    # your code here\n    pass', test_cases: ['classify_temp(35) returns "hot"', 'classify_temp(22) returns "warm"'] },
        },
        {
            day: 3, title: 'Functions',
            concepts: ['def', 'return', 'parameters', 'default args', 'docstrings'],
            task1: { title: 'Watch: Python functions', description: 'Defining and calling Python functions.', duration_minutes: 10 },
            task2: { title: 'Exercise: Write 3 functions', description: 'add, subtract, and multiply functions.', duration_minutes: 5 },
            practice: { title: 'Power calculator', description: 'Write a function that computes base to the power of exponent.', difficulty: 'beginner', starter_code: 'def power(base, exp):\n    # your code here\n    pass', test_cases: ['power(2, 3) == 8', 'power(5, 2) == 25'] },
        },
        {
            day: 4, title: 'Lists',
            concepts: ['append', 'remove', 'len', 'list comprehension', 'slicing'],
            task1: { title: 'Watch: Python lists', description: 'Core list operations and comprehensions.', duration_minutes: 10 },
            task2: { title: 'Exercise: List operations', description: 'Create a list, append items, and slice it.', duration_minutes: 5 },
            practice: { title: 'Squares list', description: 'Return a list of squares for numbers 1-n.', difficulty: 'beginner', starter_code: 'def squares(n):\n    # your code here\n    pass', test_cases: ['squares(4) == [1, 4, 9, 16]'] },
        },
        {
            day: 5, title: 'Dictionaries',
            concepts: ['dict literal', 'keys', 'values', 'get', 'items'],
            task1: { title: 'Watch: Python dicts', description: 'Creating and accessing Python dictionaries.', duration_minutes: 10 },
            task2: { title: 'Exercise: User profile dict', description: 'Create a dict with name, age, and active keys.', duration_minutes: 5 },
            practice: { title: 'Word counter', description: 'Count word frequency in a sentence using a dict.', difficulty: 'beginner', starter_code: 'def count_words(sentence):\n    # your code here\n    pass', test_cases: ['count_words("hi hi bye") == {"hi": 2, "bye": 1}'] },
        },
    ],
};
function getDefaultPlan(language = 'javascript') {
    if (language === 'python')
        return exports.DEFAULT_PYTHON_PLAN;
    return exports.DEFAULT_JS_PLAN;
}
