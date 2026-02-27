import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";

function statusMessage(status, previousStatus, isPartialUpdate) {
  const subject = isPartialUpdate
    ? "Items from your order have been"
    : "Your order has been";

  if (status === "accepted") return `${subject} accepted.`;
  if (status === "completed") return `${subject} shipped.`;
  if (status === "cancelled") return `${subject} cancelled.`;
  if (status === "pending" && previousStatus === "cancelled") {
    return `${subject} reopened.`;
  }
  return null;
}

export async function notifyMerchantNewOrder({ merchantId, orderId }) {
  if (!merchantId || !orderId) return;

  await addDoc(collection(db, "notifications"), {
    recipientId: merchantId,
    recipientRole: "merchant",
    type: "new_order",
    orderId,
    message: "You have a new order.",
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyCustomerOrderStatus({
  customerId,
  orderId,
  merchantId,
  status,
  previousStatus,
  isPartialUpdate = false,
}) {
  const message = statusMessage(status, previousStatus, isPartialUpdate);
  if (!customerId || !orderId || !merchantId || !message) return;

  await addDoc(collection(db, "notifications"), {
    recipientId: customerId,
    recipientRole: "customer",
    type: "order_status",
    orderId,
    merchantId,
    status,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyMerchantRefundRequest({
  merchantId,
  orderId,
  customerId,
}) {
  if (!merchantId || !orderId) return;

  await addDoc(collection(db, "notifications"), {
    recipientId: merchantId,
    recipientRole: "merchant",
    type: "refund_request",
    orderId,
    customerId: customerId || null,
    message: "You've received a refund request.",
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyCustomerRefundProcessed({
  customerId,
  orderId,
  merchantId,
}) {
  if (!customerId || !orderId || !merchantId) return;

  await addDoc(collection(db, "notifications"), {
    recipientId: customerId,
    recipientRole: "customer",
    type: "refund_processed",
    orderId,
    merchantId,
    message: "Your refund has been processed.",
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyMerchantOrderCancelledByCustomer({
  merchantId,
  orderId,
  customerId,
}) {
  if (!merchantId || !orderId) return;

  await addDoc(collection(db, "notifications"), {
    recipientId: merchantId,
    recipientRole: "merchant",
    type: "customer_cancelled_order",
    orderId,
    customerId: customerId || null,
    message: "An order was cancelled by the customer.",
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function notifyCustomerOrderCancelled({
  customerId,
  orderId,
  merchantId,
}) {
  if (!customerId || !orderId || !merchantId) return;

  await addDoc(collection(db, "notifications"), {
    recipientId: customerId,
    recipientRole: "customer",
    type: "order_cancelled",
    orderId,
    merchantId,
    message: "Your order was cancelled.",
    read: false,
    createdAt: serverTimestamp(),
  });
}
