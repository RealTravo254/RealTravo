declare module '@paystack/inline-js' {
  interface PaystackTransaction {
    reference: string;
    status: string;
    message: string;
    trans: string;
    transaction: string;
    trxref: string;
  }

  interface PaystackResumeOptions {
    onSuccess?: (transaction: PaystackTransaction) => void;
    onCancel?: () => void;
    onError?: (error: any) => void;
  }

  interface PaystackNewTransactionOptions {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    ref?: string;
    metadata?: Record<string, any>;
    channels?: string[];
    label?: string;
    onSuccess?: (transaction: PaystackTransaction) => void;
    onCancel?: () => void;
    onError?: (error: any) => void;
  }

  class PaystackPop {
    constructor();
    newTransaction(options: PaystackNewTransactionOptions): void;
    resumeTransaction(accessCode: string, options?: PaystackResumeOptions): void;
    checkout(options: PaystackNewTransactionOptions): Promise<PaystackTransaction>;
  }

  export default PaystackPop;
}
