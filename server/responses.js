const replies = [
  "Cześć! Miło Cię słyszeć. Mam nadzieję, że Twój dzień mija dobrze. O czym chciałbyś dziś porozmawiać?",
  "Hej! Dobrze Cię słyszeć. Jeśli masz jakieś pytania, śmiało mów. Postaram się odpowiedzieć najlepiej jak potrafię.",
  "Witaj ponownie! Uwielbiam nasze rozmowy. Co ciekawego wydarzyło się u Ciebie ostatnio?",
  "Cześć! Jestem gotowa do rozmowy. Możemy pogadać o pogodzie, książkach, technologii – co tylko chcesz!",
  "Miło Cię słyszeć! Czasem dobrze jest po prostu pogadać, prawda? O czym dziś myślisz?",
  "Cześć, tu Twoja wirtualna rozmówczyni. Słucham Cię uważnie. Możesz powiedzieć, co Cię dziś interesuje albo po prostu pogadajmy o życiu.",
  "Hej! Mam nadzieję, że masz dobry nastrój. Jestem tu, żeby porozmawiać. Co chcesz mi powiedzieć?",
  "Witaj! Jeśli chcesz, mogę Ci coś opowiedzieć albo po prostu posłuchać. Jesteśmy tu razem, więc korzystajmy z tej chwili.",
];

function getRandomReply() {
  return replies[Math.floor(Math.random() * replies.length)];
}

module.exports = { getRandomReply };
