const nodemailer = require('nodemailer');
const EmailConfigRepository = require('../repositories/EmailConfigRepository');

/**
 * Email service for sending order notifications
 */
class EmailService {
  /**
   * Send order confirmation email
   */
  static async sendOrderConfirmation(tenantId, order, orderItems, restaurantName, customerEmail) {
    try {
      const emailConfig = await EmailConfigRepository.findByTenant(tenantId);
      
      if (!emailConfig || !emailConfig.is_active) {
        console.log(`Email not configured for tenant ${tenantId}. Skipping email notification.`);
        return false;
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailConfig.email_address,
          pass: emailConfig.app_password
        }
      });

      const itemsHtml = orderItems
        .map(item => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name_snapshot}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${(item.price_snapshot * item.quantity).toFixed(2)}</td>
          </tr>
        `)
        .join('');

      const sourceLabel = {
        table: `Table ${order.source_reference}`,
        zomato: 'Zomato',
        swiggy: 'Swiggy'
      }[order.source_type] || order.source_reference;

      const mailOptions = {
        from: emailConfig.email_address,
        to: customerEmail || emailConfig.email_address,
        subject: `Order Confirmation - ${restaurantName} (Order #${order.id.substring(0, 8)})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Order Confirmation</h2>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p><strong>Restaurant:</strong> ${restaurantName}</p>
              <p><strong>Order ID:</strong> ${order.id.substring(0, 8)}</p>
              <p><strong>Source:</strong> ${sourceLabel}</p>
              <p><strong>Order Status:</strong> ${order.status}</p>
              <p><strong>Payment Status:</strong> ${order.payment_status}</p>
            </div>

            <h3 style="color: #333;">Order Items</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="text-align: right; border-top: 2px solid #ddd; padding-top: 15px; margin-top: 15px;">
              <p style="margin: 5px 0;"><strong>Subtotal:</strong> ₹${((order.total_amount - order.tax_amount) || 0).toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Tax:</strong> ₹${(order.tax_amount || 0).toFixed(2)}</p>
              ${order.discount_amount ? `<p style="margin: 5px 0; color: green;"><strong>Discount:</strong> -₹${order.discount_amount.toFixed(2)}</p>` : ''}
              <p style="margin: 10px 0; font-size: 18px;"><strong>Total Amount:</strong> ₹${(order.total_amount || 0).toFixed(2)}</p>
            </div>

            <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <p style="margin: 0;"><strong>Thank you for your order!</strong></p>
              <p style="margin: 5px 0; font-size: 12px; color: #666;">Your order has been received and will be prepared shortly.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Order confirmation email sent for order ${order.id}`);
      return true;
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
      return false;
    }
  }

  /**
   * Send order status update email
   */
  static async sendOrderStatusUpdate(tenantId, order, restaurantName, customerEmail, newStatus) {
    try {
      const emailConfig = await EmailConfigRepository.findByTenant(tenantId);
      
      if (!emailConfig || !emailConfig.is_active) {
        console.log(`Email not configured for tenant ${tenantId}. Skipping email notification.`);
        return false;
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailConfig.email_address,
          pass: emailConfig.app_password
        }
      });

      const statusMessages = {
        confirmed: 'Your order has been confirmed and is being prepared.',
        cooking: 'Your order is now being prepared.',
        ready: 'Your order is ready! Please pick it up from the counter.',
        served: 'Your order has been served.',
        cancelled: 'Your order has been cancelled.'
      };

      const mailOptions = {
        from: emailConfig.email_address,
        to: customerEmail || emailConfig.email_address,
        subject: `Order Update - ${restaurantName} (Order #${order.id.substring(0, 8)})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Order Status Update</h2>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p><strong>Order ID:</strong> ${order.id.substring(0, 8)}</p>
              <p><strong>Restaurant:</strong> ${restaurantName}</p>
              <p><strong>New Status:</strong> <span style="color: #4CAF50; font-weight: bold;">${newStatus.toUpperCase()}</span></p>
            </div>

            <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px;">
              <p style="margin: 0; font-size: 16px;">${statusMessages[newStatus] || 'Your order status has been updated.'}</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Order status update email sent for order ${order.id}`);
      return true;
    } catch (error) {
      console.error('Error sending order status update email:', error);
      return false;
    }
  }

  /**
   * Send payment confirmation email
   */
  static async sendPaymentConfirmation(tenantId, order, restaurantName, customerEmail) {
    try {
      const emailConfig = await EmailConfigRepository.findByTenant(tenantId);
      
      if (!emailConfig || !emailConfig.is_active) {
        console.log(`Email not configured for tenant ${tenantId}. Skipping email notification.`);
        return false;
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailConfig.email_address,
          pass: emailConfig.app_password
        }
      });

      const mailOptions = {
        from: emailConfig.email_address,
        to: customerEmail || emailConfig.email_address,
        subject: `Payment Confirmation - ${restaurantName} (Order #${order.id.substring(0, 8)})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Payment Confirmed</h2>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p><strong>Order ID:</strong> ${order.id.substring(0, 8)}</p>
              <p><strong>Restaurant:</strong> ${restaurantName}</p>
              <p><strong>Amount Paid:</strong> ₹${(order.total_amount || 0).toFixed(2)}</p>
              <p><strong>Payment Method:</strong> Razorpay</p>
            </div>

            <div style="background-color: #c8e6c9; padding: 15px; border-radius: 5px;">
              <p style="margin: 0; font-size: 16px; color: #2e7d32;"><strong>✓ Payment Received Successfully</strong></p>
              <p style="margin: 5px 0; font-size: 12px; color: #2e7d32;">Your order is confirmed and will be prepared shortly.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Payment confirmation email sent for order ${order.id}`);
      return true;
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      return false;
    }
  }
}

module.exports = EmailService;
