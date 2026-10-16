const answerForm = document.getElementById("answerForm");
const answerInput = document.getElementById("answerInput");
const scoreText = document.getElementById("score");
const timerText = document.getElementById("timer");
const feedback = document.getElementById("feedback");
const correctList = document.getElementById("correctList");
const startButton = document.getElementById("startButton");

let correctCards = [];
let timeLeft = 600;
let gameStarted = false;
let timerId = null;

// 입력한 카드 이름을 비교하기 쉽게 정리
function normalizeAnswer(answer) {
  return answer
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// 남은 시간을 화면에 표시
function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  timerText.textContent =
    `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// 게임 시작
function startGame() {
  correctCards = [];
  timeLeft = 600;
  gameStarted = true;

  scoreText.textContent = "0";
  feedback.textContent = "";
  correctList.innerHTML = "";
  answerInput.value = "";

  answerInput.disabled = false;
  answerForm.querySelector("button").disabled = false;
  startButton.disabled = true;

  updateTimer();
  answerInput.focus();

  timerId = setInterval(function () {
    timeLeft--;
    updateTimer();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// 게임 종료
function endGame() {
  gameStarted = false;
  clearInterval(timerId);

  answerInput.disabled = true;
  answerForm.querySelector("button").disabled = true;
  startButton.disabled = false;

  feedback.textContent =
    `게임 종료! 총 ${correctCards.length}장의 카드를 맞혔습니다.`;

  startButton.textContent = "다시 시작";
}

// 카드 이름 입력
function checkAnswer() {
  if (!gameStarted) {
    return;
  }

  const userAnswer = normalizeAnswer(answerInput.value);

  if (userAnswer === "") {
    return;
  }

  // 입력한 이름과 일치하는 카드 찾기
  const foundCard = cards.find(function (card) {
    const allNames = [card.name, ...card.aliases];

    return allNames.some(function (name) {
      return normalizeAnswer(name) === userAnswer;
    });
  });

  // 목록에 없는 카드
  if (!foundCard) {
    return;
  }

  // 이미 맞힌 카드인지 확인
  const alreadyCorrect = correctCards.some(function (card) {
    return card.name === foundCard.name;
  });

  if (alreadyCorrect) {
    return;
  }

  // 정답 처리
  correctCards.push(foundCard);

  scoreText.textContent = correctCards.length;
  feedback.textContent = "정답!";

  // 정답 목록에 카드 추가
  const listItem = document.createElement("li");
  listItem.textContent = foundCard.name;
  correctList.appendChild(listItem);

  // 정답을 입력하면 입력창 비우기
  answerInput.value = "";
}
answerInput.addEventListener("input", checkAnswer);
// 게임 시작 버튼
startButton.addEventListener("click", function () {
  if (gameStarted) {
    return;
  }

  startButton.textContent = "게임 진행 중";
  startGame();
});