// SUM-BOURBON JOE — Proof Pack sign-up forms.
//
// Binds every <form class="pp-form"> on the page. Saves first name + email to
// sbj_proof_pack (public insert, admin-only read; see README). A database
// trigger then asks the sbj-notify edge function to send the welcome email.
// A repeat sign-up with the same email is treated as success so the form
// can't be used to find out who is already on the list.

(function () {
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function bind(form) {
    var msg = form.querySelector(".pp-msg");
    var btn = form.querySelector("button[type=submit]");
    var done = form.parentElement.querySelector(".pp-done");
    var busy = false;

    function say(text, ok) {
      if (!msg) return;
      msg.textContent = text || "";
      msg.className = "pp-msg" + (text ? (ok ? " ok" : " err") : "");
    }

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      if (busy) return;
      var first = form.elements.first_name.value.trim();
      var email = form.elements.email.value.trim().toLowerCase();
      if (!first) { say("Add your first name so we know who to welcome.", false); form.elements.first_name.focus(); return; }
      if (!EMAIL_RE.test(email) || email.length > 200) { say("That email doesn't look right. Mind checking it?", false); form.elements.email.focus(); return; }

      busy = true;
      if (btn) btn.disabled = true;
      say("", true);

      var error = null;
      // Bots fill the hidden field; pretend it worked and send nothing.
      if (!form.elements.hp.value) {
        var utm = (window.sbjUtm && window.sbjUtm()) || {};
        var res = await db.from("sbj_proof_pack").insert({
          first_name: first.slice(0, 60),
          email: email,
          signup_page: form.getAttribute("data-page") || null,
          utm_source: utm.utm_source || null,
          utm_medium: utm.utm_medium || null,
          utm_campaign: utm.utm_campaign || null,
          utm_content: utm.utm_content || null,
          utm_term: utm.utm_term || null,
        });
        error = res.error;
        // 23505 = already on the list. Show the same success screen.
        if (error && error.code === "23505") error = null;
        else if (!error && window.sbjTrack) window.sbjTrack("lead", { lead_type: "proof_pack" });
      }

      busy = false;
      if (btn) btn.disabled = false;

      if (error) { say("Couldn't sign you up just now. Try again in a moment.", false); return; }

      form.reset();
      form.hidden = true;
      if (done) {
        var n = done.querySelector(".pp-done-name");
        if (n) n.textContent = first;
        done.hidden = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof db === "undefined") return;
    document.querySelectorAll("form.pp-form").forEach(bind);
  });
})();
