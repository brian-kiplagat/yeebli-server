import type { PaymentRepository } from "../repository/payment.js";
import type { Payment, NewPayment } from "../schema/schema.js";
import { logger } from "../lib/logger.js";

export class PaymentService {
  private paymentRepo: PaymentRepository;
  constructor(paymentRepo: PaymentRepository) {
    this.paymentRepo = paymentRepo;
  }

  public async createPayment(payment: NewPayment) {
    try {
      return await this.paymentRepo.createPayment(payment);
    } catch (error) {
      logger.error("Error creating payment:", error);
      throw error;
    }
  }

  public async updatePayment(id: number, payment: Partial<Payment>) {
    try {
      return await this.paymentRepo.updatePayment(id, payment);
    } catch (error) {
      logger.error("Error updating payment:", error);
      throw error;
    }
  }

  public async findByPaymentIntentId(paymentIntentId: string) {
    try {
      return await this.paymentRepo.findPaymentByPaymentIntentId(
        paymentIntentId
      );
    } catch (error) {
      logger.error("Error finding payment by intent ID:", error);
      throw error;
    }
  }

  public async findByContactId(contactId: number) {
    try {
      return await this.paymentRepo.findPaymentsByContactId(contactId);
    } catch (error) {
      logger.error("Error finding payments by contact ID:", error);
      throw error;
    }
  }
}
