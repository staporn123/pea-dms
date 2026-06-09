const API_URL =
"https://script.google.com/macros/s/AKfycbyhfY5hnfYthiIEc7k7Y1tZXNkacYHU_Jav9xjOLDefqteHvg6_MyTXedRNG8Y__RN3/exec";

async function callAPI(action, data = {}) {

  try {

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action,
        data
      })
    });

    return await response.json();

  } catch (err) {

    console.error(err);

    return {
      success: false,
      message: err.message
    };
  }
}

async function loadDashboard() {

  const result = await callAPI("init");

  if (!result.success) {
    console.error(result.message);
    return;
  }

  console.log(result);

}
