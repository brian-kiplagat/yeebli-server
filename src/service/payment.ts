import { logger } from '../lib/logger.js';
import type { PaymentRepository } from '../repository/payment.js';
import type { NewPayment, Payment } from '../schema/schema.js';

export class PaymentService {
  private paymentRepo: PaymentRepository;
  constructor(paymentRepo: PaymentRepository) {
    this.paymentRepo = paymentRepo;
  }

  public async createPayment(payment: NewPayment) {
    try {
      return await this.paymentRepo.createPayment(payment);
    } catch (error) {
      logger.error('Error creating payment:', error);
      throw error;
    }
  }

  public async updatePayment(id: number, payment: Partial<Payment>) {
    try {
      return await this.paymentRepo.updatePayment(id, payment);
    } catch (error) {
      logger.error('Error updating payment:', error);
      throw error;
    }
  }

  public async updatePaymentBySessionId(sessionId: string, payment: Partial<Payment>) {
    try {
      return await this.paymentRepo.updatePaymentBySessionId(sessionId, payment);
    } catch (error) {
      logger.error('Error updating payment:', error);
      throw error;
    }
  }

  public async findByContactId(contactId: number) {
    try {
      return await this.paymentRepo.findPaymentsByContactId(contactId);
    } catch (error) {
      logger.error('Error finding payments by contact ID:', error);
      throw error;
    }
  }
}
