import type { JobRepository } from "../db/jobRepository";
import { normalizePhone } from "./phoneService";

export class CustomerService {
  constructor(private readonly repository: JobRepository) {}

  lookupByPhone(rawPhone: string) {
    const phone_normalized = normalizePhone(rawPhone);
    const customer = this.repository.lookupCustomerByPhone(phone_normalized);
    return { phone_normalized, customer };
  }

  createCustomer(name: string, rawPhone: string) {
    const phone_normalized = normalizePhone(rawPhone);
    const customer = this.repository.upsertCustomer(name, phone_normalized);
    return { phone_normalized, customer };
  }
}
