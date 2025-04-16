require('dotenv').config(); // Load .env.local
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  try {
    console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY); // Debug: Check key
    const { data, error } = await resend.emails.send({
      from: 'MotorMania <onboarding@resend.dev>',
      to: ['toroveg2@gmail.com'],
      subject: 'Test Email',
      html: '<h1>Test from MotorMania</h1>',
    });
    if (error) console.error('Error:', error);
    else console.log('Success:', data);
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testEmail();