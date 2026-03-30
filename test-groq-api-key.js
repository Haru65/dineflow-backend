/**
 * Test script to verify Groq API key and connectivity
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testGroqAPI() {
  const apiKey = process.env.GROQ_API_KEY;
  
  console.log('🔍 Groq API Key Test');
  console.log('='.repeat(50));
  
  if (!apiKey) {
    console.error('❌ GROQ_API_KEY is not set in .env');
    process.exit(1);
  }
  
  if (apiKey === 'your_groq_api_key_here') {
    console.error('❌ GROQ_API_KEY is still set to placeholder value');
    console.error('   Please update .env with your actual Groq API key');
    console.error('   Get one at: https://console.groq.com/');
    process.exit(1);
  }
  
  console.log('✓ GROQ_API_KEY is set');
  console.log(`  Key starts with: ${apiKey.substring(0, 10)}...`);
  
  try {
    console.log('\n📡 Testing text API connectivity...');
    
    const textResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: 'Say "Groq API is working!" in one sentence.'
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('✓ Text API working!');
    console.log(`  Response: ${textResponse.data.choices[0]?.message?.content}`);
    
    console.log('\n📡 Testing image analysis...');
    
    // Create a simple test image (1x1 pixel PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const visionResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: `Analyze this image and describe what you see in one sentence.\n\nImage (base64): data:image/png;base64,${testImageBase64}`
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('✓ Image analysis working!');
    console.log(`  Response: ${visionResponse.data.choices[0]?.message?.content}`);
    console.log('\n✅ Groq API is properly configured and working!');
    console.log('   Ready for menu extraction!');
    
  } catch (error) {
    console.error('❌ API connection failed');
    console.error(`  Status: ${error.response?.status}`);
    console.error(`  Error: ${error.response?.data?.error?.message || error.message}`);
    
    if (error.response?.status === 401) {
      console.error('\n  → Invalid API key. Check your GROQ_API_KEY in .env');
    } else if (error.response?.status === 400) {
      console.error('\n  → Bad request. The model may have changed.');
      console.error('  → Check: https://console.groq.com/docs/models');
    }
    
    process.exit(1);
  }
}

testGroqAPI();
