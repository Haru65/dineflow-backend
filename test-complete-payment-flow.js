require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const TenantRepository = require('./repositories/TenantRepository');
const PaymentProviderRepository = require('./repositories/PaymentProviderRepository');
const OrderRepository = require('./repositories/OrderRepository');
const PaytmService = require('./utils/paytmService');

async function testCompletePaymentFlow() {
  try {
    console.log('🧪 Testing Complete Payment Configuration Flow...\n');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Step 1: Find restaurant
    console.log('\n📋 Step 1: Finding restaurant...');
    const tenant = await TenantRepository.findBySlug('the-shubham-cafe');
    if (!tenant) {
      console.log('❌ Restaurant not found');
      return;
    }
    console.log('✅ Restaurant found:', tenant.name, '(ID:', tenant.id + ')');

    // Step 2: Check existing Paytm configuration
    console.log('\n📋 Step 2: Checking existing Paytm configuration...');
    let paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    
    if (paytmConfig) {
      console.log('✅ Paytm configuration found in database:');
      console.log('   - ID:', paytmConfig.id);
      console.log('   - Provider:', paytmConfig.provider);
      console.log('   - Merchant ID:', paytmConfig.key_id);
      console.log('   - Key (first 8 chars):', paytmConfig.key_secret.substring(0, 8) + '...');
      console.log('   - Website:', paytmConfig.website || 'Not set');
      console.log('   - Active:', paytmConfig.is_active ? 'Yes' : 'No');
    } else {
      console.log('⚠️  No Paytm configuration found in database');
      console.log('💡 This will trigger auto-creation from environment variables');
    }

    // Step 3: Test the payment configuration API endpoint
    console.log('\n📋 Step 3: Testing payment configuration retrieval...');
    try {
      const configFromAPI = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
      if (configFromAPI) {
        console.log('✅ Payment config API working');
      } else {
        console.log('⚠️  No config returned from API');
      }
    } catch (apiError) {
      console.log('❌ Payment config API error:', apiError.message);
    }

    // Step 4: Create a test order
    console.log('\n📋 Step 4: Creating test order...');
    const testOrderId = await OrderRepository.create({
      tenant_id: tenant.id,
      table_id: null,
      source_type: 'table',
      source_reference: 'test-table-payment',
      status: 'draft',
      payment_status: 'pending',
      payment_provider: 'paytm',
      total_amount: 150.00,
      notes: 'Test order for payment flow'
    });
    console.log('✅ Test order created:', testOrderId);

    // Step 5: Test Paytm transaction creation (simulating the actual API call)
    console.log('\n📋 Step 5: Testing Paytm transaction creation...');
    
    // Simulate the request data that would come from frontend
    const requestData = {
      orderId: testOrderId,
      amount: 150.00,
      restaurantSlug: 'the-shubham-cafe',
      customerEmail: 'test@example.com',
      customerPhone: '9999999999'
    };

    console.log('📤 Request data:');
    console.log('   - Order ID:', requestData.orderId);
    console.log('   - Amount:', requestData.amount);
    console.log('   - Restaurant:', requestData.restaurantSlug);

    // Test the complete flow that happens in the Paytm route
    try {
      // Get order (simulating route logic)
      const order = await OrderRepository.findById(requestData.orderId);
      if (!order) {
        console.log('❌ Order not found');
        return;
      }
      console.log('✅ Order retrieved for payment');

      // Get tenant (simulating route logic)
      const tenantForPayment = await TenantRepository.findBySlug(requestData.restaurantSlug);
      if (!tenantForPayment || tenantForPayment.id !== order.tenant_id) {
        console.log('❌ Restaurant mismatch');
        return;
      }
      console.log('✅ Restaurant verified for payment');

      // Get Paytm config (this is where the issue might be)
      let paymentConfigForTransaction = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
      
      if (!paymentConfigForTransaction) {
        console.log('⚠️  No Paytm config found, attempting auto-creation...');
        
        const paytmMid = process.env.PAYTM_MID;
        const paytmKey = process.env.PAYTM_KEY;
        
        console.log('📋 Environment variables:');
        console.log('   - PAYTM_MID:', paytmMid || 'NOT SET');
        console.log('   - PAYTM_KEY:', paytmKey ? paytmKey.substring(0, 8) + '...' : 'NOT SET');
        
        if (!paytmMid || !paytmKey) {
          console.log('❌ Environment variables not set - this would cause 400 error');
          return;
        }
        
        // Create config (simulating the auto-creation logic)
        const configId = await PaymentProviderRepository.create({
          tenant_id: tenant.id,
          provider: 'paytm',
          key_id: paytmMid,
          key_secret: paytmKey,
          webhook_secret: null,
          is_active: 1
        });
        
        paymentConfigForTransaction = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
        console.log('✅ Paytm config auto-created:', configId);
      }

      console.log('✅ Paytm configuration ready for transaction');

      // Test transaction token creation
      console.log('\n📋 Step 6: Testing transaction token creation...');
      
      const config = {
        merchantId: paymentConfigForTransaction.key_id,
        merchantKey: paymentConfigForTransaction.key_secret,
        website: process.env.PAYTM_WEBSITE || 'WEBSTAGING',
        callbackUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/paytm/callback`
      };

      const orderData = {
        orderId: testOrderId,
        amount: 150.00,
        customerId: 'test-customer'
      };

      console.log('📋 Transaction config:');
      console.log('   - Merchant ID:', config.merchantId);
      console.log('   - Website:', config.website);
      console.log('   - Callback URL:', config.callbackUrl);

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

    } catch (flowError) {
      console.log('❌ Payment flow error:', flowError.message);
      console.log('Stack:', flowError.stack);
    }

    console.log('\n🎯 Test Summary:');
    console.log('- Database connection: ✅');
    console.log('- Restaurant lookup: ✅');
    console.log('- Order creation: ✅');
    console.log('- Payment config: ' + (paytmConfig ? '✅' : '⚠️  Auto-created'));
    console.log('- Transaction flow: Check results above');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testCompletePaymentFlow();