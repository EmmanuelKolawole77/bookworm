// Starter catalogue. Used in demo mode, and as the source for seeding Firestore.
// To push these into Firestore: sign in as an admin (see README) and run
//   seedBooks()
// in the browser console.

const cover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

export const SEED_BOOKS = [
  { id: "things-fall-apart", title: "Things Fall Apart", author: "Chinua Achebe", price: 8500, category: "Fiction", isbn: "9780385474542", cover: cover("9780385474542"), rating: 4.8, stock: 24, featured: true, pages: 209, year: 1958,
    description: "Okonkwo, a proud Igbo wrestler and farmer, sees his world unravel as colonial rule and a new faith arrive in Umuofia. A foundation stone of African literature." },
  { id: "americanah", title: "Americanah", author: "Chimamanda Ngozi Adichie", price: 12000, category: "Fiction", isbn: "9780307455925", cover: cover("9780307455925"), rating: 4.7, stock: 18, featured: true, pages: 477, year: 2013,
    description: "Ifemelu and Obinze leave Lagos for different lives abroad. A sharp, funny love story about race, identity and coming home." },
  { id: "purple-hibiscus", title: "Purple Hibiscus", author: "Chimamanda Ngozi Adichie", price: 7900, category: "Fiction", isbn: "9781616202415", cover: cover("9781616202415"), rating: 4.6, stock: 30, featured: false, pages: 307, year: 2003,
    description: "Fifteen-year-old Kambili lives under her father's strict religious rule until a stay with her aunt shows her another way to live." },
  { id: "half-of-a-yellow-sun", title: "Half of a Yellow Sun", author: "Chimamanda Ngozi Adichie", price: 9200, category: "Politics and history", isbn: "9781400095209", cover: cover("9781400095209"), rating: 4.8, stock: 15, featured: true, pages: 433, year: 2006,
    description: "Three lives intertwine in the years before and during the Biafran war. Intimate, devastating and humane." },
  { id: "born-a-crime", title: "Born a Crime", author: "Trevor Noah", price: 10500, category: "Memoir", isbn: "9780399588174", cover: cover("9780399588174"), rating: 4.8, stock: 22, featured: true, pages: 304, year: 2016,
    description: "Stories from a South African childhood under apartheid, told with warmth and a comedian's timing." },
  { id: "homegoing", title: "Homegoing", author: "Yaa Gyasi", price: 11000, category: "Fiction", isbn: "9781101947135", cover: cover("9781101947135"), rating: 4.6, stock: 12, featured: false, pages: 320, year: 2016,
    description: "Two half-sisters, one sold into slavery and one married to a British slaver, and the generations that follow them." },
  { id: "atomic-habits", title: "Atomic Habits", author: "James Clear", price: 9800, category: "Business", isbn: "9780735211292", cover: cover("9780735211292"), rating: 4.7, stock: 40, featured: false, pages: 320, year: 2018,
    description: "A practical system for building good habits and breaking bad ones, one small change at a time." },
  { id: "the-alchemist", title: "The Alchemist", author: "Paulo Coelho", price: 6500, category: "Fiction", isbn: "9780062315007", cover: cover("9780062315007"), rating: 4.3, stock: 35, featured: false, pages: 208, year: 1988,
    description: "A shepherd boy follows a recurring dream from Spain to the Egyptian desert in search of treasure." },
  { id: "the-fishermen", title: "The Fishermen", author: "Chigozie Obioma", price: 8800, category: "Fiction", isbn: "9780316338387", cover: cover("9780316338387"), rating: 4.4, stock: 14, featured: false, pages: 304, year: 2015,
    description: "Four brothers in Akure ignore their father's rules and meet a madman's prophecy at the river." },
  { id: "we-should-all-be-feminists", title: "We Should All Be Feminists", author: "Chimamanda Ngozi Adichie", price: 4500, category: "Politics and history", isbn: "9781101911761", cover: cover("9781101911761"), rating: 4.6, stock: 50, featured: false, pages: 52, year: 2014,
    description: "A short, personal and persuasive essay adapted from her TEDx talk." },
  { id: "a-long-walk-to-freedom", title: "Long Walk to Freedom", author: "Nelson Mandela", price: 13500, category: "Memoir", isbn: "9780316548182", cover: cover("9780316548182"), rating: 4.7, stock: 9, featured: false, pages: 656, year: 1994,
    description: "The autobiography of Nelson Mandela, from a village childhood to twenty-seven years in prison and the presidency." },
  { id: "the-lion-and-the-jewel", title: "The Lion and the Jewel", author: "Wole Soyinka", price: 6200, category: "Fiction", isbn: "9780195110647", cover: cover("9780195110647"), rating: 4.2, stock: 16, featured: false, pages: 80, year: 1963,
    description: "A comedy of village life in Ilunjinle, where the schoolteacher Lakunle and Baroka the Bale compete for the beautiful Sidi." }
];

export const CATEGORIES = ["All", "Fiction", "Politics and history", "Business", "Memoir", "Children"];

export const SEED_REVIEWS = [
  { name: "Adaeze O.", rating: 5, text: "Delivery to Enugu took three days and the books arrived perfectly wrapped. Already ordered again." },
  { name: "Tunde A.", rating: 5, text: "Finally a shop where I can find Nigerian authors without hunting. The prices are fair too." },
  { name: "Halima B.", rating: 4, text: "Lovely selection and a very easy checkout. I would love more children's titles." }
];
