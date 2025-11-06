document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll("button[data-redirect]");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const target = button.getAttribute("data-redirect");
            window.location.href = target;
        });
    });
});
