const jwt = require("jsonwebtoken");
const token = jwt.sign({ user: "Gap" }, "Gap");
console.log(token);
