const API_URL = 'https://pos-backend.fdsevx.workers.dev/api/v1';

async function testApi() {
  console.log("1. Logging in...");
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'password123' })
  });
  const loginData = await loginRes.json();
  
  if (!loginData.tokens?.access_token) {
    console.error("Login failed:", loginData);
    return;
  }
  
  const token = loginData.tokens.access_token;
  console.log("Login success! Token acquired.");

  console.log("\n2. Fetching products (cafe)...");
  const productsRes = await fetch(`${API_URL}/cafe/products`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const productsData = await productsRes.json();
  console.log("Products response:", productsData);

  console.log("\n3. Testing Add Product...");
  const addRes = await fetch(`${API_URL}/cafe/products`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sku: "TEST-01",
      name: "Produk Test",
      price: "10000",
      cost_price: "5000",
      stock: 10,
      track_stock: true,
      is_available: true
    })
  });
  const addData = await addRes.json();
  console.log("Add product response:", addData);
}

testApi();
