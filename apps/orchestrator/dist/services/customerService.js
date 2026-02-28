"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerService = void 0;
const phoneService_1 = require("./phoneService");
class CustomerService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    lookupByPhone(rawPhone) {
        const phone_normalized = (0, phoneService_1.normalizePhone)(rawPhone);
        const customer = this.repository.lookupCustomerByPhone(phone_normalized);
        return { phone_normalized, customer };
    }
    createCustomer(name, rawPhone) {
        const phone_normalized = (0, phoneService_1.normalizePhone)(rawPhone);
        const customer = this.repository.upsertCustomer(name, phone_normalized);
        return { phone_normalized, customer };
    }
}
exports.CustomerService = CustomerService;
