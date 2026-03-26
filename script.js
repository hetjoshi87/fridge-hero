(function () {
  "use strict";

  const GEMINI_API_KEY = 'AIzaSyBC7G74-ZIHa2_OcN3jhcIjIhr38aEfpFw'
    typeof window !== "undefined" && window.__GEMINI_API_KEY__
      ? String(window.__GEMINI_API_KEY__).trim()
      : "";

  const GEMINI_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  const form = document.getElementById("fridge-form");
  const submitBtn = form.querySelector('button[type="submit"]');
  const resultCard = document.getElementById("result-card");
  const resultDish = document.getElementById("result-dish");
  const resultSteps = document.getElementById("result-steps");
  const resultError = document.getElementById("result-error");
  const resultSuccess = document.getElementById("result-success");

  function getIngredients() {
    return [
      document.getElementById("ingredient-1").value.trim(),
      document.getElementById("ingredient-2").value.trim(),
      document.getElementById("ingredient-3").value.trim(),
    ];
  }

  function buildPrompt(a, b, c) {
    return (
      "You are a creative chef. Given these 3 ingredients: " +
      a +
      ", " +
      b +
      ", " +
      c +
      ", create:\n" +
      "1. A fancy French-inspired dish name\n" +
      "2. A 3-step cooking instruction (each step one sentence)\n" +
      "Format as JSON: {dishName: string, steps: string[]}"
    );
  }

  function parseJsonFromModelText(text) {
    const trimmed = String(text).trim();
    const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
    const raw = fence ? fence[1].trim() : trimmed;
    return JSON.parse(raw);
  }

  function showResultAnimation() {
    resultCard.hidden = false;
    resultCard.classList.remove("result-card--animate");
    void resultCard.offsetWidth;
    resultCard.classList.add("result-card--animate");
  }

  function showSuccess(data) {
    resultError.hidden = true;
    resultError.textContent = "";
    resultSuccess.hidden = false;
    resultDish.textContent = data.dishName || "Chef's creation";
    resultSteps.innerHTML = "";
    const steps = Array.isArray(data.steps) ? data.steps : [];
    steps.forEach(function (step) {
      const li = document.createElement("li");
      li.textContent = String(step);
      resultSteps.appendChild(li);
    });
    showResultAnimation();
  }

  function showError(message) {
    resultSuccess.hidden = true;
    resultDish.textContent = "";
    resultSteps.innerHTML = "";
    resultError.hidden = false;
    resultError.textContent = message;
    showResultAnimation();
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.setAttribute("aria-busy", loading ? "true" : "false");
    if (loading) {
      if (!submitBtn.dataset.label) {
        submitBtn.dataset.label = submitBtn.textContent;
      }
      submitBtn.textContent = "Cooking…";
    } else if (submitBtn.dataset.label) {
      submitBtn.textContent = submitBtn.dataset.label;
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const parts = getIngredients();
    if (!parts[0] || !parts[1] || !parts[2]) {
      showError("Please fill in all three ingredients.");
      return;
    }

    if (!GEMINI_API_KEY) {
      showError(
        "Missing API key. Copy config.local.example.js to config.local.js and set your key, or run: node write-config.js (with GEMINI_API_KEY in your environment)."
      );
      return;
    }

    const url = GEMINI_URL + "?key=" + encodeURIComponent(GEMINI_API_KEY);
    const body = {
      contents: [
        {
          parts: [{ text: buildPrompt(parts[0], parts[1], parts[2]) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    setLoading(true);

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          let errMsg = "Something went wrong. Please try again.";
          if (!res.ok) {
            try {
              const errJson = JSON.parse(text);
              if (errJson.error && errJson.error.message) {
                errMsg = errJson.error.message;
              }
            } catch (ignore) {
              /* use default */
            }
            throw new Error(errMsg);
          }
          return text;
        });
      })
      .then(function (text) {
        const parsed = JSON.parse(text);
        const first = parsed.candidates && parsed.candidates[0];
        if (!first) {
          throw new Error("No recipe returned. Try again.");
        }
        const candidate = first.content && first.content.parts && first.content.parts[0];
        const rawText = candidate && candidate.text ? candidate.text : "";
        if (!rawText) {
          throw new Error("No recipe returned. Try again.");
        }
        const recipe = parseJsonFromModelText(rawText);
        if (!recipe.dishName || !Array.isArray(recipe.steps)) {
          throw new Error("Could not read the recipe format. Try again.");
        }
        showSuccess(recipe);
      })
      .catch(function (err) {
        let msg =
          err && err.message
            ? err.message
            : "Network error. Check your connection and try again.";
        if (err instanceof SyntaxError) {
          msg = "Could not parse the recipe. Try again.";
        }
        showError(msg);
      })
      .finally(function () {
        setLoading(false);
      });
  });
})();
