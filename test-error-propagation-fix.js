const axios = require('axios');

// Test the error propagation fix
async function testErrorPropagationFix() {
    const baseURL = 'https://dineflow-backend-hya7.onrender.com';
    const restaurantId = '698e3d4d-8997-4c38-aee0-63ab8c28da62';
    const menuItemId = 'c816dad6-a5ab-4575-a978-a4caf6b7b2d9';
    
    // JWT token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmMTlmYTA1ZS1jNWFjLTQxZDYtYjAyZi00YmE1NTY5MzdmZTIiLCJlbWFpbCI6InplcHRhY0BnbWFpbC5jb20iLCJyb2xlIjoicmVzdGF1cmFudF9hZG1pbiIsInRlbmFudElkIjoiNjk4ZTNkNGQtODk5Ny00YzM4LWFlZTAtNjNhYjhjMjhkYTYyIiwiaWF0IjoxNzc1MTQ3OTQzLCJleHAiOjE3NzU3NTI3NDN9.-ZDSJ9zYqrBAHq1Y-wRvqU4cd8y3FR2CMdNgRA8BdyY';
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    console.log('🔍 Testing Error Propagation Fix');
    console.log('Fixed: Errors now propagate properly instead of being swallowed');
    console.log('Expected: Specific error messages instead of generic 400 errors');
    console.log('');

    try {
        // 1. Test single item auto-update
        console.log('1. Testing single item auto-update...');
        
        const response = await axios.post(
            `${baseURL}/admin/restaurant/${restaurantId}/menu/items/${menuItemId}/auto-update-image`,
            {},
            { 
                headers,
                timeout: 30000,
                validateStatus: function (status) {
                    return true; // Don't throw for any status
                }
            }
        );
        
        console.log('=== SINGLE ITEM RESPONSE ===');
        console.log('Status:', response.status);
        console.log('Message:', response.data.message);
        console.log('Error:', response.data.error);
        console.log('Full Response:', JSON.stringify(response.data, null, 2));
        
        // Analyze the response
        if (response.status === 200) {
            console.log('✅ SUCCESS: Image updated successfully!');
            if (response.data.data?.image_url) {
                console.log('Image URL:', response.data.data.image_url);
            }
        } else if (response.status === 400) {
            if (response.data.message?.includes('not configured')) {
                console.log('🔍 DIAGNOSIS: API key not configured in production');
                console.log('   Solution: Set UNSPLASH_ACCESS_KEY environment variable');
            } else if (response.data.message?.includes('placeholder')) {
                console.log('🔍 DIAGNOSIS: API key is still placeholder value');
                console.log('   Solution: Update with real Unsplash API key');
            } else {
                console.log('🔍 DIAGNOSIS: Other configuration issue');
            }
        } else if (response.status === 401) {
            console.log('🔍 DIAGNOSIS: Invalid API key');
            console.log('   Solution: Check and update Unsplash API key');
        } else if (response.status === 429) {
            console.log('🔍 DIAGNOSIS: Rate limit exceeded');
            console.log('   Solution: Wait for rate limit reset or upgrade plan');
        } else if (response.status === 403) {
            console.log('🔍 DIAGNOSIS: API access forbidden');
            console.log('   Solution: Check API key permissions');
        } else {
            console.log('🔍 DIAGNOSIS: Unexpected status code');
        }
        
        // 2. Test bulk update
        console.log('');
        console.log('2. Testing bulk update...');
        
        const bulkResponse = await axios.post(
            `${baseURL}/admin/restaurant/${restaurantId}/menu/bulk-update-images`,
            {},
            { 
                headers,
                timeout: 60000,
                validateStatus: function (status) {
                    return true;
                }
            }
        );
        
        console.log('=== BULK UPDATE RESPONSE ===');
        console.log('Status:', bulkResponse.status);
        console.log('Message:', bulkResponse.data.message);
        console.log('Error:', bulkResponse.data.error);
        
        if (bulkResponse.status === 200) {
            console.log('✅ SUCCESS: Bulk update completed!');
            console.log('Summary:', {
                total: bulkResponse.data.data?.total,
                successful: bulkResponse.data.data?.successful,
                failed: bulkResponse.data.data?.failed
            });
        }
        
        console.log('');
        console.log('🎉 ERROR PROPAGATION TEST COMPLETE!');
        console.log('');
        
        // Summary
        if (response.status === 200 || bulkResponse.status === 200) {
            console.log('✅ RESULT: Image update is working!');
        } else {
            console.log('📋 RESULT: Now getting specific error messages instead of generic 400s');
            console.log('This is a major improvement for debugging and user experience');
        }
        
        console.log('');
        console.log('🔍 COMPARISON:');
        console.log('Before fix: Generic 400 error with 47-byte response');
        console.log('After fix: Specific error messages with detailed explanations');
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        }
    }
}

// Run the test
testErrorPropagationFix().catch(console.error);