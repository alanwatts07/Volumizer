"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var web3_js_1 = require("@solana/web3.js");
var fs = require('fs');
var node_fetch_1 = require("node-fetch");
var bs58_1 = require("bs58");
var bot_wallet_1 = require("../assets/bot-wallet");
var child_process_1 = require("child_process");
var dotenv = require('dotenv');
dotenv.config();
var TIP_ACCOUNT = "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";
var filePath = './assets/transactions2.json';
var url = "https://mainnet.block-engine.jito.wtf/api/v1/bundles"; // Jito API endpoint
var mainSigner = web3_js_1.Keypair.fromSecretKey(new Uint8Array(bot_wallet_1.KEYCODE));
var RPC_URL = process.env.RPC_URL;
// Utility function to delay
var delay = function (ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); };
var isValidBase58 = function (input) {
    try {
        bs58_1["default"].decode(input);
        return true;
    }
    catch (error) {
        return false;
    }
};
// Load transaction data from JSON file, taking only the first 4 transactions
var readTransactions = function (filePath) {
    var data = fs.readFileSync(filePath, 'utf8');
    var transactions = JSON.parse(data);
    return transactions.slice(0, 4).map(function (tx) { return tx.rawTransaction; }); // Take the first 4 transactions
};
// Send the transaction bundle to Jito's Block Engine and retrieve bundle ID
var sendBundleToJito = function (transactions) { return __awaiter(void 0, void 0, void 0, function () {
    var requestBody, response, errorResponse, responseData, bundleId;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (transactions.length > 5) {
                    throw new Error("Bundles cannot contain more than 5 transactions.");
                }
                requestBody = {
                    jsonrpc: "2.0",
                    id: 11,
                    method: "sendBundle",
                    params: [transactions]
                };
                // Validate each transaction before sending
                transactions.forEach(function (tx, index) {
                    if (!isValidBase58(tx)) {
                        throw new Error("Transaction at index ".concat(index, " is not a valid base58-encoded string."));
                    }
                });
                return [4 /*yield*/, (0, node_fetch_1["default"])(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    })];
            case 1:
                response = _a.sent();
                if (!!response.ok) return [3 /*break*/, 3];
                return [4 /*yield*/, response.text()];
            case 2:
                errorResponse = _a.sent();
                throw new Error("Failed to send bundle. Status code: ".concat(response.status, ", Response: ").concat(errorResponse));
            case 3: return [4 /*yield*/, response.json()];
            case 4:
                responseData = _a.sent();
                if (responseData.result) {
                    bundleId = responseData.result;
                    console.log("Bundle ID:", bundleId); // Logs the bundle ID for reference
                    return [2 /*return*/, bundleId];
                }
                else {
                    throw new Error("No bundle ID returned from the bundle submission.");
                }
                return [2 /*return*/];
        }
    });
}); };
// Check the status of the bundle
var checkBundleStatus = function (bundleId) { return __awaiter(void 0, void 0, void 0, function () {
    var requestBody, response, errorResponse;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                requestBody = {
                    "jsonrpc": "2.0",
                    "id": 11,
                    "method": "getBundleStatuses",
                    "params": [[bundleId]]
                };
                return [4 /*yield*/, (0, node_fetch_1["default"])(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    })];
            case 1:
                response = _a.sent();
                if (!!response.ok) return [3 /*break*/, 3];
                return [4 /*yield*/, response.text()];
            case 2:
                errorResponse = _a.sent();
                throw new Error("Failed to get bundle status. Status code: ".concat(response.status, ", Response: ").concat(errorResponse));
            case 3: return [2 /*return*/, response.json()];
        }
    });
}); };
// Retry mechanism to check bundle status
var mainWithRetry = function (bundleId) { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, maxAttempts, response;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                attempts = 0;
                maxAttempts = 2;
                _b.label = 1;
            case 1:
                if (!(attempts < maxAttempts)) return [3 /*break*/, 4];
                return [4 /*yield*/, checkBundleStatus(bundleId)];
            case 2:
                response = _b.sent();
                if ((_a = response.result) === null || _a === void 0 ? void 0 : _a.value.length) {
                    console.log("Bundle Status Response:", response);
                    return [2 /*return*/];
                }
                console.log("Attempt ".concat(attempts + 1, ": No status information available, retrying..."));
                attempts++;
                return [4 /*yield*/, delay(5000)];
            case 3:
                _b.sent(); // Wait 10 seconds before retrying
                return [3 /*break*/, 1];
            case 4:
                console.log("Max attempts reached. The bundle status is still not available.");
                return [4 /*yield*/, main()];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); };
// Main function to process transactions and check bundle status
// Main function to process transactions and check bundle status
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var connection, recentBlockhash, signedTransactions, response, bundleId, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                connection = new web3_js_1.Connection(RPC_URL, 'confirmed');
                return [4 /*yield*/, connection.getLatestBlockhash()];
            case 1:
                recentBlockhash = (_a.sent()).blockhash;
                console.log("Recent Blockhash:", recentBlockhash);
                signedTransactions = readTransactions(filePath);
                if (signedTransactions.length === 0) {
                    console.error("No valid transactions to bundle.");
                    return [2 /*return*/];
                }
                // Output final transactions for bundling
                console.log("Final signed transactions for bundling:", signedTransactions);
                _a.label = 2;
            case 2:
                _a.trys.push([2, 5, , 6]);
                return [4 /*yield*/, sendBundleToJito(signedTransactions)];
            case 3:
                response = _a.sent();
                bundleId = response;
                console.log("Bundle submitted. Bundle ID:", response);
                return [4 /*yield*/, mainWithRetry(bundleId)];
            case 4:
                _a.sent();
                return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                console.error("Error sending bundle:", error_1.message);
                (0, child_process_1.exec)('ts-node ./utils/buy-bot-holders.ts', function (error, stdout, stderr) {
                    if (error) {
                        console.error("Error executing script: ".concat(error.message));
                        return;
                    }
                    if (stderr) {
                        console.error("Script error output: ".concat(stderr));
                        return;
                    }
                    console.log("Script output: ".concat(stdout));
                });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
main()["catch"](function (error) { return console.error("Error:", error.message); });
