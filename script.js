const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
const portrait = document.querySelector(".portrait");
const siteHeader = document.querySelector(".site-header");
const contactForm = document.querySelector(".contact-form");

let scrollTicking = false;

const updateHeader = () => {
  siteHeader?.classList.toggle("is-scrolled", window.scrollY > 48);
  scrollTicking = false;
};

window.addEventListener(
  "scroll",
  () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateHeader);
  },
  { passive: true },
);

updateHeader();

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const subject = formData.get("Subject");
  const body = [
    `Name: ${formData.get("Name")}`,
    `Email: ${formData.get("Email")}`,
    "",
    formData.get("Message"),
  ].join("\n");

  window.location.href = `mailto:itsai01@calpoly.edu?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
});

if (portrait) {
  portrait.addEventListener("error", () => {
    portrait.classList.add("is-missing");
  });
}

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";

  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Open navigation" : "Close navigation",
  );
  navigation.classList.toggle("is-open", !isOpen);
  document.body.style.overflow = isOpen ? "" : "hidden";
});

navigation.addEventListener("click", (event) => {
  if (!event.target.matches("a")) return;

  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  navigation.classList.remove("is-open");
  document.body.style.overflow = "";
});
