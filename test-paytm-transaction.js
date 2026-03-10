require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const TenantRepository = require('./repositories/TenantRepository');
const PaymentProviderRepository = require('./repositories/PaymentProviderRepository');
const OrderRepository = require('./repositories/OrderRepository');
const PaytmService = require('./utils/paytmService');

async function testPaytmTransaction() {
  try {
    console.log('🧪 Testing Paytm Transaction Creation...');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Find restaurant
    const tenant = await TenantRepository.findBySlug('the-shubham-cafe');
    if (!tenant) {
      console.log('❌ Restaurant not found');
      return;
    }
    console.log('✅ Restaurant found:', tenant.name);

    // Check Paytm configuration
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paytmConfig) {
      console.log('❌ No Paytm configuration found');
      console.log('💡 Run: npm run setup-paytm');
      return;
    }
    console.log('✅ Paytm configuration found');

    // Create a test order first
    console.log('\n📝 Creating test order...');
    const testOrderId = await OrderRepository.create({
      tenant_id: tenant.id,
      table_id: null,
      source_type: 'table',
      source_reference: 'test-table',
      status: 'draft',
      payment_status: 'pending',
      payment_provider: 'paytm',
      total_amount: 100.00,
      notes: 'Test order for Paytm'
    });
    console.log('✅ Test order created:', testOrderId);

    // Test Paytm transaction creation
    console.log('\n🔄 Testing Paytm transaction creation...');
    
    const config = {
      merchantId: paytmConfig.key_id,
      merchantKey: paytmConfig.key_secret,
      website: process.env.PAYTM_WEBSITE || 'WEBSTAGING',
      callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/paytm/callback`
    };

    const orderData = {
      orderId: testOrderId,
      amount: 100.00,
      customerId: 'test-customer'
    };

    console.log('📋 Configuration:');
    console.log('   - Merchant ID:', config.merchantId);
    console.log('   - Website:', config.website);
    console.log('   - Callback URL:', config.callbackUrl);
    console.log('   - Order ID:', orderData.orderId);
    console.log('   - Amount:', orderData.amount);

    try {
      const tokenResponse = await PaytmService.createTransactionToken(config, orderData);
      
      if (tokenResponse && tokenResponse.body && tokenResponse.body.txnToken) {
        console.log('✅ Transaction token created successfully!');
        console.log('   - Token (first 20 chars):', tokenResponse.body.txnToken.substring(0, 20) + '...');
        console.log('   - Result Code:', tokenResponse.body.resultInfo?.resultCode);
        console.log('   - Result Message:', tokenResponse.body.resultInfo?.resultMsg);
      } else {
        console.log('❌ Transaction token creation failed');
        console.log('Response:', JSON.stringify(tokenResponse, null, 2));
      }
    } catch (paytmError) {
      console.log('❌ Paytm API Error:', paytmError.message);
      if (paytmError.response) {
        console.log('Response Status:', paytmError.response.status);
        console.log('Response Data:', JSON.stringify(paytmError.response.data, null, 2));
      }
    }

    // Clean up test order
    console.log('\n🧹 Cleaning up test order...');
    // Note: We'll leave the test order for debugging purposes

    console.log('\n🎯 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testPaytmTransaction();