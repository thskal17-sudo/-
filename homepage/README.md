# 한국엑스퍼트교육원 홈페이지

`index.html` 파일 하나로 된 홈페이지입니다. 더블클릭하면 브라우저에서 바로 열립니다.

## 고칠 곳 (index.html 아래쪽 `<script>` 바로 밑)

```js
const LINKS = {
  gangsaitda: 'https://gangsaitda.com',
  gyoannote: ''   // ← 교안노트 주소를 따옴표 안에 넣기
};
const FORM_ENDPOINT = '';   // ← 문의를 자동으로 받을 주소 (아래 참고)
```

- 교안노트 주소를 비워 두면 화면에 '준비 중'으로 나오고 눌러지지 않습니다.
- 주소를 넣으면 상단 메뉴·바로가기 카드·하단, 세 곳이 한 번에 바뀝니다.

## 문의창이 동작하는 방식

- **지금 (FORM_ENDPOINT 비어 있음):** '문의 보내기'를 누르면 방문자의 메일 앱이 열리고,
  받는 사람 koexpert@naver.com 과 문의 내용이 채워집니다. 메일 앱이 없는 PC 를 위해
  내용 복사 버튼도 함께 나옵니다.
- **자동 접수로 바꾸려면:** [Formspree](https://formspree.io) 같은 무료 문의 접수 서비스에
  koexpert@naver.com 으로 가입하고, 새 폼을 만들면 `https://formspree.io/f/...` 주소를 줍니다.
  그 주소를 `FORM_ENDPOINT` 에 넣으면 방문자가 메일 앱 없이 바로 보내고, 문의가 메일로 옵니다.

## 인터넷에 올리기

정적 파일이라 어디든 올릴 수 있습니다. 가장 쉬운 방법은 [Netlify Drop](https://app.netlify.com/drop) 에
`homepage` 폴더를 끌어다 놓는 것입니다. 이후 가지고 있는 도메인을 연결하면 됩니다.
