const scoreText = document.getElementById("score");
const timerText = document.getElementById("timer");
const answerInput = document.getElementById("answerInput");
const feedback = document.getElementById("feedback");
const startButton = document.getElementById("startButton");
const hintButton = document.getElementById("hintButton");
const quizBoard = document.getElementById("quizBoard");
const hintImage = document.getElementById("hintImage");
const hintMessage = document.getElementById("hintMessage");
const revealAllButton = document.getElementById("revealAllButton");
const topButton = document.getElementById("topButton");

let cards = [];
let solvedNames = new Set();
let forfeitedNames = new Set(); // 추가: 힌트 패스/전체보기로 공개된 카드
let slotByName = new Map();

let elapsedSeconds = 0;
let timerId = null;
let currentHintCard = null; // 추가: 현재 힌트로 띄워둔 카드
let gameStarted = false;
let revealConfirmTimeoutId = null;
let revealConfirmPending = false;

function normalizeAnswer(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findCardByAnswer(answer) {
  return cards.find(card => {
    const officialName = normalizeAnswer(card.name);

    const aliases = Array.isArray(card.aliases)
      ? card.aliases
      : [];

    return (
      officialName === answer ||
      aliases.some(alias =>
        typeof alias === "string" &&
        normalizeAnswer(alias) === answer
      )
    );
  });
}

function updateScore() {
  scoreText.textContent = `정답: ${solvedNames.size} / ${cards.length}`;
}

function updateTimer() {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  timerText.textContent =
    `걸린 시간: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getSectionName(card) {
  return `레벨 ${card.level}`;
}

function renderBoard() {
  quizBoard.replaceChildren();
  slotByName.clear();

  const groups = new Map();

  for (const card of cards) {
    const sectionName = getSectionName(card);

    if (!groups.has(sectionName)) {
      groups.set(sectionName, []);
    }

    groups.get(sectionName).push(card);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    return Number(a[1][0].level) - Number(b[1][0].level);
  });

  for (const [sectionName, groupCards] of sortedGroups) {
    groupCards.sort((a, b) => {
      const atkA = Number(a.atk);
      const atkB = Number(b.atk);

      if (Number.isFinite(atkA) && Number.isFinite(atkB)) {
        return atkB - atkA;
      }

      if (Number.isFinite(atkA)) return -1;
      if (Number.isFinite(atkB)) return 1;
      return a.name.localeCompare(b.name);
    });

    const section = document.createElement("section");
    section.className = "level-section";

    const header = document.createElement("div");
    header.className = "level-header";

    const heading = document.createElement("h2");
    heading.textContent = sectionName;

    const progress = document.createElement("span");
    progress.className = "level-progress";
    progress.textContent = `0 / ${groupCards.length}`;

    header.append(heading, progress);

    const grid = document.createElement("div");
    grid.className = "card-grid";

    const sectionNames = groupCards.map(card =>
      normalizeAnswer(card.name)
    );

    for (const card of groupCards) {
      const normalizedName = normalizeAnswer(card.name);

      const slot = document.createElement("div");
      slot.className = "card-slot";

      const placeholder = document.createElement("div");
      placeholder.className = "card-placeholder";
      placeholder.textContent = "?";

      const image = document.createElement("img");
      image.className = "card-image";
      image.alt = card.name;
      image.hidden = true;
      image.src = `./images/${card.file_name}`;

      image.addEventListener("error", () => {
        image.alt = `${card.name} 이미지 불러오기 실패`;
      });

      const name = document.createElement("div");
      name.className = "card-name";
      name.textContent = "미입력";

      slot.append(placeholder, image, name);
      grid.appendChild(slot);

      slotByName.set(normalizedName, {
        slot,
        placeholder,
        image,
        name,
        progress,
        sectionNames
      });
    }

    section.append(header, grid);
    quizBoard.appendChild(section);
  }
}

// isScored: true면 정답(초록색), false면 패스/전체공개(붉은색) 처리
function revealCard(card, isScored = true) {
  const normalizedName = normalizeAnswer(card.name);

  if (solvedNames.has(normalizedName) || forfeitedNames.has(normalizedName)) return false;

  const elements = slotByName.get(normalizedName);
  if (!elements) return false;

  elements.placeholder.hidden = true;
  elements.image.hidden = false;
  elements.name.textContent = card.name;

  if (isScored) {
    elements.slot.classList.add("solved");
    solvedNames.add(normalizedName);
  } else {
    elements.slot.classList.add("forfeited");
    forfeitedNames.add(normalizedName);
  }

  // 섹션 진행도는 맞힌 카드와 패스한 카드를 모두 포함하여 계산
  const sectionCleared = elements.sectionNames.filter(name =>
    solvedNames.has(name) || forfeitedNames.has(name)
  ).length;

  elements.progress.textContent =
    `${sectionCleared} / ${elements.sectionNames.length}`;

  updateScore();

  if (solvedNames.size + forfeitedNames.size === cards.length) {
    endGame("모든 카드가 공개됐습니다!");
  }

  return true;
}

function submitAnswer() {
  if (!gameStarted) return;

  const answer = normalizeAnswer(answerInput.value);
  if (!answer) return;

  const card = findCardByAnswer(answer);
  if (!card) return;

  const normalizedName = normalizeAnswer(card.name);

  if (solvedNames.has(normalizedName)) {
    feedback.textContent = `이미 맞히신 카드입니다: ${card.name}`;
    return;
  }
  
  if (forfeitedNames.has(normalizedName)) {
    feedback.textContent = `이미 패스(공개)된 카드입니다: ${card.name}`;
    return;
  }

  const accepted = revealCard(card, true); // 정답 맞힘

  if (accepted) {
    feedback.textContent = `정답입니다! ${card.name}`;
    answerInput.value = "";

    // 힌트로 떠 있던 카드를 맞혔을 경우 힌트 초기화
    if (currentHintCard && normalizeAnswer(currentHintCard.name) === normalizedName) {
      hintMessage.textContent = "";
      clearHint();
    }
  }
}

function clearHint() {
  hintImage.hidden = true;
  hintImage.removeAttribute("src");
  currentHintCard = null;
}

function showHint() {
  if (!gameStarted) return;

  // 이미 힌트가 떠 있는 상태에서 한 번 더 누르면 정답 처리 (점수 미포함)
  if (currentHintCard) {
    revealCard(currentHintCard, false);
    hintMessage.textContent = `'${currentHintCard.name}' 카드를 패스(점수 미포함) 처리했어.`;
    clearHint();
    return;
  }

  const unsolvedCards = cards.filter(card =>
    !solvedNames.has(normalizeAnswer(card.name)) &&
    !forfeitedNames.has(normalizeAnswer(card.name))
  );

  if (unsolvedCards.length === 0) {
    hintMessage.textContent = "아직 남은 카드가 없어!";
    clearHint();
    return;
  }

  currentHintCard = unsolvedCards[
    Math.floor(Math.random() * unsolvedCards.length)
  ];

  hintMessage.textContent = "이 카드의 이름은 무엇일까요? 패스하려면 힌트를 한 번 더 주세요.";

  hintImage.onload = () => {
    hintImage.hidden = false;
  };

  hintImage.onerror = () => {
    hintImage.hidden = true;
    hintMessage.textContent = "힌트 이미지를 불러오지 못했어. 이미지 경로를 확인해 줘.";
  };

  hintImage.src = `./images/${currentHintCard.file_name}`;
}

function resetRevealConfirmation() {
  if (revealConfirmTimeoutId !== null) {
    clearTimeout(revealConfirmTimeoutId);
    revealConfirmTimeoutId = null;
  }

  revealConfirmPending = false;
  revealAllButton.classList.remove("confirming");
  revealAllButton.textContent = "전체 정답 보기";
}

function handleRevealAll() {
  if (!gameStarted) return;

  if (!revealConfirmPending) {
    revealConfirmPending = true;
    revealAllButton.classList.add("confirming");
    revealAllButton.textContent = "3초 안에 다시 눌러 주세요";

    feedback.textContent =
      "전체 정답을 공개하시려면 3초 이내에 버튼을 한 번 더 눌러 주세요.";

    revealConfirmTimeoutId = setTimeout(() => {
      resetRevealConfirmation();
      feedback.textContent =
        "전체 정답 공개가 취소되었습니다. 필요하시면 다시 시도해 주세요.";
    }, 3000);

    return;
  }

  resetRevealConfirmation();

  // 모든 카드를 점수 미포함 상태(false)로 공개
  for (const card of cards) {
    revealCard(card, false);
  }

  endGame("전체 정답을 공개했습니다.");
}

function endGame(message) {
  gameStarted = false;

  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

  resetRevealConfirmation();

  answerInput.disabled = true;
  hintButton.disabled = true;
  revealAllButton.disabled = true;
  startButton.disabled = false;
  startButton.textContent = "다시 시작";

  clearHint();

  feedback.textContent =
    `${message} 최종 정답: ${solvedNames.size} / ${cards.length}. ${timerText.textContent}`;
}

function startGame() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

  resetRevealConfirmation();
  clearHint();

  solvedNames.clear();
  forfeitedNames.clear(); // 시작 시 패스 목록도 초기화
  elapsedSeconds = 0;
  gameStarted = true;

  renderBoard();
  updateScore();
  updateTimer();

  answerInput.disabled = false;
  answerInput.value = "";
  answerInput.focus();

  hintButton.disabled = false;
  revealAllButton.disabled = false;

  startButton.disabled = true;
  startButton.textContent = "퀴즈 진행 중";

  feedback.textContent = "카드 이름을 입력해 주세요.";
  hintMessage.textContent =
    "힌트 버튼을 누르면 이미지가 표시되며, 한 번 더 누르면 카드를 패스할 수 있습니다.";

  timerId = setInterval(() => {
    elapsedSeconds++;
    updateTimer();
  }, 1000);
}

async function loadCards() {
  try {
    const response = await fetch("./cards.json");

    if (!response.ok) {
      throw new Error(`cards.json 불러오기 실패: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("cards.json의 최상위 데이터는 배열이어야 해.");
    }

    cards = data.filter(card =>
      typeof card.name === "string" &&
      typeof card.file_name === "string" &&
      card.file_name.length > 0 &&
      Number.isFinite(Number(card.level))
    );

    if (cards.length === 0) {
      throw new Error("사용 가능한 카드 데이터가 없어.");
    }

    renderBoard();
    updateScore();

    startButton.disabled = false;
  } catch (error) {
    console.error(error);

    feedback.textContent =
      "카드 데이터를 불러오지 못했어. cards.json의 위치와 JSON 형식을 확인해 줘.";

    startButton.disabled = true;
  }
}

answerInput.addEventListener("input", submitAnswer);

answerInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitAnswer();
  }
});

revealAllButton.addEventListener("click", handleRevealAll);

topButton.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

startButton.addEventListener("click", startGame);
hintButton.addEventListener("click", showHint);

startButton.disabled = true;
hintButton.disabled = true;
revealAllButton.disabled = true;

loadCards();