const nodemailer = require('nodemailer');

// Create transporter based on SMTP config
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send order confirmation email to customer
const sendOrderConfirmation = async (user, orderId, items, totalAmount, address) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('⚠️  SMTP not configured. Skipping email.');
      return { success: false, message: 'SMTP not configured' };
    }

    const transporter = createTransporter();

    const itemsList = items.map(item => 
      `• ${item.name} x${item.quantity} - $${item.price * item.quantity}`
    ).join('\n');

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: `Order Confirmed - #${orderId} | LaSutra Boutique`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 20px; text-align: center;">
            <h1 style="color: #e94560; margin: 0;">LaSutra Boutique</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f8f8;">
            <h2 style="color: #333;">Thank You for Your Order! 🎉</h2>
            
            <p>Dear <strong>${user.name}</strong>,</p>
            
            <p>Your order has been confirmed and will be shipped soon!</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #e94560; margin-top: 0;">Order Details</h3>
              <p><strong>Order ID:</strong> #${orderId}</p>
              <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #e94560; margin-top: 0;">Items Ordered</h3>
              <ul style="list-style: none; padding: 0;">
                ${items.map(item => `
                  <li style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    ${item.name} x${item.quantity} - <strong>$${item.price * item.quantity}</strong>
                  </li>
                `).join('')}
              </ul>
              <p style="font-size: 18px;"><strong>Total: $${totalAmount.toFixed(2)}</strong></p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #e94560; margin-top: 0;">Shipping Address</h3>
              <p>${address.state}, ${address.country}</p>
              <p>Pin Code: ${address.pinCode}</p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If you have any questions, please contact us.
            </p>
          </div>
          
          <div style="background: #1a1a2e; padding: 20px; text-align: center; color: white;">
            <p style="margin: 0;">&copy; 2024 LaSutra Boutique. All rights reserved.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Order confirmation sent to ${user.email}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Error sending order email:', err.message);
    return { success: false, message: err.message };
  }
};

// Send admin notification when new order is placed
const sendAdminNotification = async (user, orderId, items, totalAmount, address) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) {
      console.log('⚠️  SMTP or ADMIN_EMAIL not configured. Skipping admin notification.');
      return { success: false, message: 'SMTP or ADMIN_EMAIL not configured' };
    }

    const transporter = createTransporter();

    const itemsList = items.map(item => 
      `• ${item.name} x${item.quantity} - $${item.price * item.quantity}`
    ).join('\n');

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `🛒 New Order Received - #${orderId} | LaSutra Boutique`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #e94560; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">🛒 New Order Received!</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f8f8;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #e94560; margin-top: 0;">Customer Details</h3>
              <p><strong>Name:</strong> ${user.name}</p>
              <p><strong>Email:</strong> ${user.email}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #e94560; margin-top: 0;">Order Details</h3>
              <p><strong>Order ID:</strong> #${orderId}</p>
              <p><strong>Total Amount:</strong> <span style="font-size: 24px; color: #00d9a5;">$${totalAmount.toFixed(2)}</span></p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #e94560; margin-top: 0;">Items Ordered</h3>
              <ul style="list-style: none; padding: 0;">
                ${items.map(item => `
                  <li style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    ${item.name} x${item.quantity} - <strong>$${item.price * item.quantity}</strong>
                  </li>
                `).join('')}
              </ul>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #e94560; margin-top: 0;">Shipping Address</h3>
              <p>${address.state}, ${address.country}</p>
              <p>Pin Code: ${address.pinCode}</p>
            </div>
            
            <a href="#" style="display: inline-block; background: #e94560; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
              View Order in Admin Panel
            </a>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Admin notification sent to ${process.env.ADMIN_EMAIL}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Error sending admin notification:', err.message);
    return { success: false, message: err.message };
  }
};

module.exports = {
  sendOrderConfirmation,
  sendAdminNotification
};
