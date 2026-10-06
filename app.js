const TOTAL = PLAYERS.length;

const grid =
  document.getElementById("grid");

const countEl =
  document.getElementById("count");

const barFill =
  document.getElementById("barFill");

const remainingNamesEl =
  document.getElementById("remainingNames");

const remainingCountEl =
  document.getElementById("remainingCount");

const unguessedTab =
  document.getElementById("unguessedTab");

const guessedTab =
  document.getElementById("guessedTab");

const unguessedCountEl =
  document.getElementById("unguessedCount");

const guessedCountEl =
  document.getElementById("guessedCount");


const selections =
  new Map();


let submitted = false;

let cards = [];

let activeView =
  "unguessed";


/* =========================================================
   HELPERS
   ========================================================= */

function norm(s) {

  return s
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9 ]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function shuffle(a) {

  for (
    let i = a.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    [
      a[i],
      a[j]
    ] = [
      a[j],
      a[i]
    ];

  }


  return a;

}


function lastNameSort(
  a,
  b
) {

  const aParts =
    a.name
      .trim()
      .split(/\s+/);

  const bParts =
    b.name
      .trim()
      .split(/\s+/);


  const aLast =
    aParts[
      aParts.length - 1
    ];

  const bLast =
    bParts[
      bParts.length - 1
    ];


  return (
    aLast.localeCompare(
      bLast
    ) ||

    a.name.localeCompare(
      b.name
    )
  );

}


const board =
  shuffle(
    [...PLAYERS]
  );


/* =========================================================
   WNBA HEADSHOTS
   ========================================================= */

/*
 * ESPN exposes player information through each team's
 * roster endpoint.
 *
 * This is different from the broken league-wide athlete
 * endpoint used in the first version.
 *
 * We query all WNBA teams, read their roster athletes,
 * and build one name -> image URL map.
 */

const ESPN_TEAMS = [
  "atl",
  "chi",
  "con",
  "dal",
  "ind",
  "lv",
  "la",
  "min",
  "ny",
  "phx",
  "sea",
  "gs",
  "por",
  "tor",
  "was"
];


async function loadTeamRoster(
  team
) {

  const url =
    `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${team}/roster`;


  try {

    const response =
      await fetch(url);


    if (!response.ok) {

      return [];

    }


    const data =
      await response.json();


    /*
     * ESPN has used both a flat athletes array
     * and position-grouped athlete arrays.
     *
     * Handle both structures.
     */

    const athletes =
      [];


    if (
      Array.isArray(
        data.athletes
      )
    ) {

      data.athletes.forEach(
        item => {

          if (
            item &&
            Array.isArray(
              item.items
            )
          ) {

            athletes.push(
              ...item.items
            );

          }

          else if (item) {

            athletes.push(
              item
            );

          }

        }
      );

    }


    return athletes;

  }

  catch (error) {

    console.warn(
      `Could not load ${team} roster`,
      error
    );


    return [];

  }

}


async function resolveImages() {

  const imageMap =
    new Map();


  const rosterResults =
    await Promise.all(
      ESPN_TEAMS.map(
        team =>
          loadTeamRoster(team)
      )
    );


  rosterResults
    .flat()
    .forEach(
      athlete => {

        const name =
          athlete.displayName ||
          athlete.fullName ||
          athlete.name;


        if (!name) {

          return;

        }


        let imageUrl =
          null;


        /*
         * Prefer the actual headshot URL ESPN
         * sends with the athlete object.
         */

        if (
          athlete.headshot &&
          athlete.headshot.href
        ) {

          imageUrl =
            athlete.headshot.href;

        }


        /*
         * If the object contains an ESPN athlete ID
         * but no explicit headshot URL, ESPN's static
         * image CDN uses the athlete ID.
         */

        if (
          !imageUrl &&
          athlete.id
        ) {

          imageUrl =
            `https://a.espncdn.com/i/headshots/wnba/players/full/${athlete.id}.png`;

        }


        if (imageUrl) {

          imageMap.set(
            norm(name),
            imageUrl
          );

        }

      }
    );


  return imageMap;

}


/* =========================================================
   NAME AVAILABILITY
   ========================================================= */

function usedElsewhere(
  cardId
) {

  return new Set(

    [...selections.entries()]

      .filter(
        ([id]) =>
          id !== cardId
      )

      .map(
        ([, name]) =>
          name
      )

  );

}


function matches(
  query,
  name
) {

  const q =
    norm(query);


  if (!q) {

    return true;

  }


  const n =
    norm(name);


  return q
    .split(" ")
    .every(
      part =>
        n.includes(
          part
        )
    );

}


/* =========================================================
   REMAINING NAMES
   ========================================================= */

function updateRemaining() {

  const used =
    new Set(
      selections.values()
    );


  const remaining =
    PLAYERS

      .filter(
        player =>
          !used.has(
            player.name
          )
      )

      .sort(
        lastNameSort
      );


  remainingCountEl.textContent =
    remaining.length;


  remainingNamesEl.innerHTML =
    "";


  if (
    remaining.length === 0
  ) {

    const message =
      document.createElement(
        "div"
      );


    message.className =
      "remainingEmpty";


    message.textContent =
      "Every name has been assigned.";


    remainingNamesEl.appendChild(
      message
    );


    return;

  }


  remaining.forEach(
    player => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "remainingName";


      row.textContent =
        player.name;


      remainingNamesEl.appendChild(
        row
      );

    }
  );

}


/* =========================================================
   VIEW MANAGEMENT
   ========================================================= */

function updateView() {

  const guessed =
    selections.size;


  const unguessed =
    TOTAL -
    guessed;


  guessedCountEl.textContent =
    guessed;


  unguessedCountEl.textContent =
    unguessed;


  cards.forEach(
    ({
      card,
      player
    }) => {

      const isGuessed =
        selections.has(
          player.id
        );


      const shouldShow =
        activeView ===
        "guessed"
          ? isGuessed
          : !isGuessed;


      card.classList.toggle(
        "viewHidden",
        !shouldShow
      );

    }
  );


  const showingUnguessed =
    activeView ===
    "unguessed";


  unguessedTab
    .classList
    .toggle(
      "active",
      showingUnguessed
    );


  guessedTab
    .classList
    .toggle(
      "active",
      !showingUnguessed
    );


  unguessedTab.setAttribute(
    "aria-selected",
    String(
      showingUnguessed
    )
  );


  guessedTab.setAttribute(
    "aria-selected",
    String(
      !showingUnguessed
    )
  );

}


/* =========================================================
   PROGRESS
   ========================================================= */

function updateProgress() {

  const matched =
    selections.size;


  countEl.textContent =
    matched;


  barFill.style.width =
    (
      matched /
      TOTAL *
      100
    ) + "%";


  updateRemaining();

  updateView();

}


/* =========================================================
   AUTOCOMPLETE
   ========================================================= */

function renderMenu(
  card,
  input,
  menu,
  player
) {

  if (submitted) {

    return;

  }


  const used =
    usedElsewhere(
      player.id
    );


  const options =
    PLAYERS

      .filter(
        candidate =>

          !used.has(
            candidate.name
          ) &&

          matches(
            input.value,
            candidate.name
          )
      )

      .sort(
        lastNameSort
      )

      .slice(
        0,
        12
      );


  menu.innerHTML =
    "";


  if (
    options.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "empty";


    empty.textContent =
      "No available names match.";


    menu.appendChild(
      empty
    );


    menu.classList.add(
      "open"
    );


    return;

  }


  options.forEach(
    candidate => {

      const option =
        document.createElement(
          "div"
        );


      option.className =
        "option";


      option.textContent =
        candidate.name;


      option.setAttribute(
        "role",
        "option"
      );


      option.addEventListener(
        "mousedown",
        event => {

          event.preventDefault();


          choose(
            card,
            input,
            menu,
            player,
            candidate.name
          );

        }
      );


      menu.appendChild(
        option
      );

    }
  );


  menu.classList.add(
    "open"
  );

}


/* =========================================================
   CHOOSE ANSWER
   ========================================================= */

function choose(
  card,
  input,
  menu,
  player,
  name
) {

  selections.set(
    player.id,
    name
  );


  input.value =
    name;


  input.dataset.selected =
    name;


  card.classList.add(
    "matched"
  );


  menu.classList.remove(
    "open"
  );


  updateProgress();

}


/* =========================================================
   CLEAR ANSWER
   ========================================================= */

function clearChoice(
  card,
  input,
  menu,
  player
) {

  selections.delete(
    player.id
  );


  input.value =
    "";


  input.dataset.selected =
    "";


  card.classList.remove(
    "matched"
  );


  menu.classList.remove(
    "open"
  );


  updateProgress();

}


/* =========================================================
   CREATE CARD
   ========================================================= */

function makeCard(
  player,
  index,
  images
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "card";


  card.dataset.id =
    player.id;


  /*
   * Deliberately only one image element.
   *
   * No initials.
   * No replacement image.
   * No second image layer.
   */

  card.innerHTML = `

    <div class="photoWrap">

      <div class="rank">
        FACE ${index + 1}
      </div>

      <img
        hidden
        alt="WNBA player headshot"
      >

    </div>


    <div class="answer">

      <input
        autocomplete="off"
        spellcheck="false"
        aria-label="Name this WNBA player"
        placeholder="Type a player name…"
      >


      <button
        type="button"
        class="clear"
        aria-label="Clear answer"
      >
        ×
      </button>


      <div
        class="menu"
        role="listbox"
      ></div>

    </div>


    <div class="feedback"></div>

  `;


  const img =
    card.querySelector(
      "img"
    );


  const input =
    card.querySelector(
      "input"
    );


  const menu =
    card.querySelector(
      ".menu"
    );


  const clear =
    card.querySelector(
      ".clear"
    );


  /* -------------------------
     HEADSHOT
     ------------------------- */

  const imageUrl =
    images.get(
      norm(
        player.name
      )
    );


  if (imageUrl) {

    img.src =
      imageUrl;


    img.onload =
      () => {

        img.hidden =
          false;

      };


    img.onerror =
      () => {

        img.hidden =
          true;

      };

  }


  /* -------------------------
     INPUT
     ------------------------- */

  input.addEventListener(
    "focus",
    () => {

      renderMenu(
        card,
        input,
        menu,
        player
      );

    }
  );


  input.addEventListener(
    "input",
    () => {

      if (
        input.dataset.selected &&
        input.value !==
          input.dataset.selected
      ) {

        selections.delete(
          player.id
        );


        input.dataset.selected =
          "";


        card.classList.remove(
          "matched"
        );


        updateProgress();

      }


      renderMenu(
        card,
        input,
        menu,
        player
      );

    }
  );


  /* -------------------------
     KEYBOARD
     ------------------------- */

  input.addEventListener(
    "keydown",
    event => {

      const options =
        [
          ...menu.querySelectorAll(
            ".option"
          )
        ];


      let active =
        options.findIndex(
          option =>
            option.classList.contains(
              "active"
            )
        );


      if (
        event.key ===
        "ArrowDown"
      ) {

        event.preventDefault();


        active =
          Math.min(
            active + 1,
            options.length - 1
          );


        options.forEach(
          option =>
            option.classList.remove(
              "active"
            )
        );


        options[
          active
        ]?.classList.add(
          "active"
        );


        options[
          active
        ]?.scrollIntoView(
          {
            block:
              "nearest"
          }
        );

      }


      if (
        event.key ===
        "ArrowUp"
      ) {

        event.preventDefault();


        active =
          Math.max(
            active - 1,
            0
          );


        options.forEach(
          option =>
            option.classList.remove(
              "active"
            )
        );


        options[
          active
        ]?.classList.add(
          "active"
        );


        options[
          active
        ]?.scrollIntoView(
          {
            block:
              "nearest"
          }
        );

      }


      if (
        event.key ===
          "Enter" &&
        options.length
      ) {

        event.preventDefault();


        const chosen =
          options[
            Math.max(
              active,
              0
            )
          ];


        choose(
          card,
          input,
          menu,
          player,
          chosen.textContent
        );

      }


      if (
        event.key ===
        "Escape"
      ) {

        menu.classList.remove(
          "open"
        );

      }

    }
  );


  input.addEventListener(
    "blur",
    () => {

      setTimeout(
        () => {

          menu.classList.remove(
            "open"
          );

        },
        100
      );

    }
  );


  clear.addEventListener(
    "click",
    () => {

      clearChoice(
        card,
        input,
        menu,
        player
      );

    }
  );


  grid.appendChild(
    card
  );


  cards.push(
    {
      card,
      input,
      player
    }
  );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function init() {

  document
    .getElementById(
      "imageNotice"
    )
    .textContent =
      "Loading WNBA player headshots…";


  const images =
    await resolveImages();


  board.forEach(
    (
      player,
      index
    ) => {

      makeCard(
        player,
        index,
        images
      );

    }
  );


  updateProgress();


  const missing =
    PLAYERS.filter(
      player =>
        !images.has(
          norm(
            player.name
          )
        )
    ).length;


  if (
    missing === 0
  ) {

    document
      .getElementById(
        "imageNotice"
      )
      .textContent =
        "2026 WNBA Face Match • Top 75 by regular-season minutes played.";

  }

  else {

    document
      .getElementById(
        "imageNotice"
      )
      .textContent =
        `WNBA headshots loaded. ${missing} of ${TOTAL} player images could not be matched.`;

  }

}


init();


/* =========================================================
   VIEW BUTTONS
   ========================================================= */

unguessedTab.addEventListener(
  "click",
  () => {

    activeView =
      "unguessed";


    updateView();

  }
);


guessedTab.addEventListener(
  "click",
  () => {

    activeView =
      "guessed";


    updateView();

  }
);


/* =========================================================
   SUBMIT
   ========================================================= */

document
  .getElementById(
    "submitBtn"
  )
  .addEventListener(
    "click",
    () => {

      const missing =
        TOTAL -
        selections.size;


      if (
        missing &&
        !confirm(
          `You still have ${missing} unmatched ${missing === 1 ? "player" : "players"}. Submit anyway?`
        )
      ) {

        return;

      }


      submitted =
        true;


      let score =
        0;


      cards.forEach(
        ({
          card,
          input,
          player
        }) => {

          const guess =
            selections.get(
              player.id
            ) || "";


          const correct =
            guess ===
            player.name;


          if (correct) {

            score++;

          }


          card.classList.add(
            correct
              ? "correct"
              : "wrong"
          );


          card
            .querySelector(
              ".feedback"
            )
            .textContent =
              correct
                ? "✓ Correct"
                : `✕ ${guess || "No answer"} → ${player.name}`;


          input.disabled =
            true;


          card
            .querySelector(
              ".clear"
            )
            .style
            .display =
              "none";

        }
      );


      activeView =
        selections.size
          ? "guessed"
          : "unguessed";


      updateView();


      document
        .getElementById(
          "score"
        )
        .textContent =
          score;


      document
        .getElementById(
          "scoreLine"
        )
        .textContent =

          score >= 68
            ? "Elite WNBA face recognition."

          : score >= 55
            ? "You know this league extremely well."

          : score >= 38
            ? "Solid — the rotation players got you."

          : "The bottom half of the minutes leaderboard won this round.";


      document
        .getElementById(
          "results"
        )
        .showModal();

    }
  );


/* =========================================================
   RESULTS
   ========================================================= */

document
  .getElementById(
    "reviewBtn"
  )
  .addEventListener(
    "click",
    () => {

      document
        .getElementById(
          "results"
        )
        .close();

    }
  );


document
  .getElementById(
    "playAgainBtn"
  )
  .addEventListener(
    "click",
    () => {

      location.reload();

    }
  );


document
  .getElementById(
    "resetBtn"
  )
  .addEventListener(
    "click",
    () => {

      if (
        confirm(
          "Clear every answer and reshuffle the board?"
        )
      ) {

        location.reload();

      }

    }
  );


/* =========================================================
   MOBILE NAME PANEL
   ========================================================= */

const remainingPanel =
  document.querySelector(
    ".remainingPanel"
  );


const remainingToggle =
  document.getElementById(
    "remainingToggle"
  );


remainingToggle.addEventListener(
  "click",
  () => {

    const open =
      remainingPanel
        .classList
        .toggle(
          "open"
        );


    remainingToggle.setAttribute(
      "aria-expanded",
      String(open)
    );


    remainingToggle.textContent =
      open
        ? "Hide remaining names"
        : "Show remaining names";

  }
);