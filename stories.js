// Picture stories for the slideshow. Each story is a list of event ids from data.js,
// and every neighbouring pair must be a link in data.js (node check.mjs checks this).
window.STORIES = [
  { id: "paper", title: "How paper got us to the Moon", ids: ["paper", "papersamarkand", "papermill", "gutenberg", "galileo", "newton", "apollo"] },
  { id: "volcano", title: "The volcano that made a monster", ids: ["tambora", "nosummer", "frankenstein"] },
  { id: "tea", title: "A cup of tea starts revolutions", ids: ["tea", "teabritain", "bostontea", "amrev", "frenchrev", "haiti", "louisiana"] },
  { id: "gold", title: "Mali's gold sends ships around the world", ids: ["camel", "ghanagold", "mansamusa", "catalan", "portugal", "dagama", "chili"] },
  { id: "germs", title: "Invisible germs, a mountain of silver", ids: ["columbus", "smallpox", "incafall", "potosi", "manila"] },
  { id: "peace", title: "An essay that freed millions", ids: ["thoreau", "gandhisa", "saltmarch", "montgomery", "mandela"] },
  { id: "pizza", title: "Where pizza comes from", ids: ["tomato", "tomatoitaly", "pizza"] },
  { id: "wars", title: "From world war to human rights", ids: ["ww1", "versailles", "nazis", "ww2", "un", "udhr"] },
  { id: "internet", title: "A satellite beeps, and we get the internet", ids: ["sputnik", "arpa", "arpanet", "www", "smartphone", "arabspring"] },
  { id: "all", title: "All of history, in order", ids: null }
];
