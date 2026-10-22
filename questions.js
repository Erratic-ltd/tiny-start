// Placeholder questions so the app has something to show. Delete them in
// Manage questions > All questions once you have your own.
//
// Question types:
//   "typed" + check "math"  : answer written with the typing rules (* for multiply, ^ for power, c / c1, c2 for constants)
//   "typed"                 : plain text answer
//   "choice"                : one correct option
//   "method"                : tick every method that applies ("spot the method")
const starterCards = [
  {
    id: "starter-int-poly",
    course: "Maths",
    topic: "Integration",
    type: "typed",
    check: "math",
    question: "Integrate 4x³ − 2x with respect to x.",
    answer: "x^4-x^2+c",
    explanation: "Raise each power by one and divide by the new power. Don't forget + c."
  },
  {
    id: "starter-diff-product",
    course: "Maths",
    topic: "Differentiation",
    type: "typed",
    check: "math",
    question: "Differentiate x² sin(x).",
    answer: "2*x*sin(x)+x^2*cos(x)",
    explanation: "Product rule: (first)' × second + first × (second)'."
  },
  {
    id: "starter-de-second",
    course: "Maths",
    topic: "Differential equations",
    type: "typed",
    check: "math",
    prefix: "y =",
    question: "Find the general solution of y'' − 5y' + 6y = 0.",
    answer: "c1*e^(2*x)+c2*e^(3*x)",
    explanation: "Characteristic equation r² − 5r + 6 = 0 gives r = 2 and r = 3."
  },
  {
    id: "starter-de-first",
    course: "Maths",
    topic: "Differential equations",
    type: "typed",
    check: "math",
    prefix: "y =",
    question: "Find the general solution of dy/dx = 3y.",
    answer: "c*e^(3*x)",
    explanation: "Separate the variables: dy/y = 3 dx, so ln|y| = 3x + const."
  },
  {
    id: "starter-line",
    course: "Maths",
    topic: "Algebra",
    type: "typed",
    check: "math",
    question: "Write the equation of the line through (0, 1) with gradient 2. Type the whole equation.",
    answer: "y=2*x+1",
    explanation: "y = mx + b with m = 2 and b = 1."
  },
  {
    id: "starter-ln",
    course: "Maths",
    topic: "Differentiation",
    type: "choice",
    question: "What is the derivative of ln x?",
    options: ["1/x", "x", "ln x", "eˣ"],
    answer: "1/x",
    explanation: "A rule to know by heart."
  },
  {
    id: "starter-method-product-chain",
    course: "Maths",
    topic: "Differentiation",
    type: "method",
    question: "Differentiate sin(x²) · eˣ.",
    options: ["Product rule", "Chain rule", "Quotient rule", "Integration by parts"],
    answers: ["Product rule", "Chain rule"],
    explanation: "Two functions multiplied, and one of them has a function inside another."
  },
  {
    id: "starter-method-parts",
    course: "Maths",
    topic: "Integration",
    type: "method",
    question: "Evaluate the integral of x eˣ.",
    options: ["Substitution", "Integration by parts", "Partial fractions", "Trig substitution"],
    answers: ["Integration by parts"],
    explanation: "A polynomial multiplied by an exponential, where the inside is not the derivative of the other part."
  },
  {
    id: "starter-method-ratio",
    course: "Maths",
    topic: "Series",
    type: "method",
    question: "Does the series with terms n! / 3ⁿ converge?",
    options: ["Ratio test", "Integral test", "Alternating series test", "Comparison with 1/n"],
    answers: ["Ratio test"],
    explanation: "Factorials and powers in the same term are a strong sign to use the ratio test."
  },
  {
    id: "starter-force-unit",
    course: "Physics",
    topic: "Forces",
    type: "typed",
    question: "What is the SI unit of force?",
    answer: "newton",
    accept: ["N", "newtons"],
    explanation: "One newton accelerates 1 kg at 1 m/s²."
  }
];
