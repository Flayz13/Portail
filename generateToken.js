const jwt = require("jsonwebtoken");
const token = jwt.sign({ user: "demo" }, "votre_cle_secrete");
console.log(token);