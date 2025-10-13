const axios = require('axios');

const commitment66 = '0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d6';
const commitment65 = '0x22083c8b84ffd614c26468f2ada0c1baad4df98d81a0e1d7d757beb0155dd2d';

async function testEndpoints() {
  console.log('🧪 Testing backend endpoints after restart...\n');
  
  // Test 1: Active loans with 66-char commitment
  console.log('📊 Test 1: Active loans (66 chars)');
  console.log('URL:', `http://localhost:3000/api/loan/borrower/${commitment66}/active`);
  try {
    const response = await axios.get(`http://localhost:3000/api/loan/borrower/${commitment66}/active`);
    console.log('✅ Response:', response.data);
    console.log('   Loans found:', response.data.count);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n📊 Test 2: Active loans (65 chars)');
  console.log('URL:', `http://localhost:3000/api/loan/borrower/${commitment65}/active`);
  try {
    const response = await axios.get(`http://localhost:3000/api/loan/borrower/${commitment65}/active`);
    console.log('✅ Response:', response.data);
    console.log('   Loans found:', response.data.count);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Test 3: Applications with 66-char commitment
  console.log('\n📊 Test 3: Applications (66 chars)');
  console.log('URL:', `http://localhost:3000/api/loan/borrower/${commitment66}/applications`);
  try {
    const response = await axios.get(`http://localhost:3000/api/loan/borrower/${commitment66}/applications`);
    console.log('✅ Response:', response.data);
    console.log('   Applications found:', response.data.applications?.length || 0);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n📊 Test 4: Applications (65 chars)');
  console.log('URL:', `http://localhost:3000/api/loan/borrower/${commitment65}/applications`);
  try {
    const response = await axios.get(`http://localhost:3000/api/loan/borrower/${commitment65}/applications`);
    console.log('✅ Response:', response.data);
    console.log('   Applications found:', response.data.applications?.length || 0);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n✅ All tests completed!');
}

testEndpoints().catch(console.error);
