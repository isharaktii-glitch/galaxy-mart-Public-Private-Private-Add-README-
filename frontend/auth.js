// frontend/auth.js

// ---- 1. LOGIN FUNCTION ----
async function handleLogin(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      // Token එක සහ User Role එක Browser එකේ තැන්පත් කිරීම (දැන් Dashboard එකෙන් එලියට දාන්නේ නැහැ)
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_role', data.user.role);

      alert('Login Successful! Redirecting...');

      // Role එක අනුව අදාළ HTML පිටුවට යොමු කිරීම
      if (data.user.role === 'admin') {
        window.location.href = '/admin.html';
      } else if (data.user.role === 'seller') {
        window.location.href = '/seller.html';
      } else {
        window.location.href = '/customer.html'; // සාමාන්‍ය පාරිභෝගිකයා සඳහා
      }
    } else {
      alert('Login Failed: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error during login:', error);
    alert('Something went wrong. Please try again.');
  }
}

// ---- 2. REGISTER FUNCTION ----
async function handleRegister(userData) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (data.success) {
      alert('Registration Successful! Please login now.');
      // රෙජිස්ටර් වූ පසු කෙලින්ම index.html (Login) පිටුවට හෝ අදාළ තැනට යැවීම
      window.location.href = '/index.html'; 
    } else {
      alert('Registration Failed: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error during registration:', error);
    alert('Something went wrong. Please try again.');
  }
}
