// utils/db.js
const db = require('../database');

const promisify = (fn) => {
  return (...args) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err, ...results) => {
        if (err) reject(err);
        else resolve(results.length === 1 ? results[0] : results);
      });
    });
  };
};

module.exports = {
  all: promisify(db.all.bind(db)),
  get: promisify(db.get.bind(db)),
  run: promisify(db.run.bind(db)),
  exec: promisify(db.exec.bind(db))
};