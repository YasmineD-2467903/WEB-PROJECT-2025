document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    const usernameInput = form.querySelector("input[name='uname']");
    const passwordInput = form.querySelector("input[name='psw']");
    const confirmationInput = form.querySelector("input[name='cpsw']");
    const rememberCheckbox = form.querySelector("input[name='remember']");

  // submit knop listener
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const uname = usernameInput.value;
    const psw = passwordInput.value;
    const cpsw = confirmationInput.value;

    if (!uname || !psw) {
        alert("Please enter username and password.");
        return;
    }

    // i want to check here for already existing usernames? and print an alert like "this user already exists"

    if (psw != cpsw) {
        alert("Passwords do not match!");
        return;
    }

    try {
      const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname, password: psw }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message);

        if (rememberCheckbox.checked) {
          setCookie("rememberedUser", uname, 7);
        } else {
          deleteCookie("rememberedUser");
        }

        window.location.href = "/fyp";
        
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Something went wrong. Please try again later.");
    }
  });
});


// Cookie functions
// EVERYTHING saves browser-side

function setCookie(name, value, days) {
  
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = `${name}=${value};${expires};path=/`;

}

function getCookie(name) {

  const cname = name + "=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let c of ca) {
    while (c.charAt(0) === ' ') c = c.substring(1);
    if (c.indexOf(cname) === 0) return c.substring(cname.length, c.length);
  }
  return "";

}

function deleteCookie(name) {

  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

}
