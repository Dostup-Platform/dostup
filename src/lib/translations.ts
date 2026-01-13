export type Language = "ru" | "kk";

export const translations = {
  ru: {
    // Common
    back: "Назад",
    loading: "Загрузка...",
    signOut: "Выйти",
    signIn: "Войти",
    processing: "Обработка...",
    save: "Сохранить",
    cancel: "Отмена",
    delete: "Удалить",
    edit: "Редактировать",
    add: "Добавить",
    create: "Создать",
    view: "Просмотр",
    close: "Закрыть",
    confirm: "Подтвердить",
    oneTime: "единоразово",
    continue: "Продолжить",
    
    // Navigation
    materials: "Материалы",
    schedule: "Расписание",
    account: "Аккаунт",
    products: "Продукты",
    users: "Пользователи",
    
    // Product Page
    getAccess: "Получить доступ",
    
    // Checkout
    orderSummary: "Итого заказа",
    secureCheckout: "Безопасная оплата",
    email: "Электронная почта",
    emailPlaceholder: "вы@example.com",
    fullName: "Полное имя",
    namePlaceholder: "Ваше имя",
    payWithKaspi: "Оплатить через Kaspi",
    kaspiPaymentInfo: "После оплаты в Kaspi нажмите кнопку ниже",
    paidContinue: "Я оплатил, продолжить",
    noPaymentMethod: "Способ оплаты не настроен",
    termsAgreement: "Оплачивая, вы соглашаетесь с нашими условиями использования.",
    
    // Password Setup
    paymentSuccessful: "Оплата прошла успешно!",
    setupPassword: "Установите пароль для доступа к покупке",
    createAccount: "Создать аккаунт",
    loggedInAs: "Вход как",
    password: "Пароль",
    createPassword: "Создайте пароль",
    confirmPassword: "Подтвердите пароль",
    confirmPasswordPlaceholder: "Подтвердите ваш пароль",
    passwordMinLength: "Пароль должен быть не менее 8 символов",
    passwordsNotMatch: "Пароли не совпадают",
    creatingAccount: "Создание аккаунта...",
    accessPurchase: "Получить доступ к покупке",
    
    // Auth Page
    signInTitle: "Войти",
    signInDescription: "Доступ к вашим покупкам",
    yourPassword: "Ваш пароль",
    signingIn: "Вход...",
    noAccount: "Нет аккаунта? Купите продукт для получения доступа.",
    
    // Dashboard
    myDashboard: "Мой кабинет",
    creatorDashboard: "Панель создателя",
    
    // Materials Tab
    myMaterials: "Мои материалы",
    noMaterials: "Материалы пока недоступны",
    purchaseToAccess: "Купите продукт для доступа к материалам",
    
    // Schedule Tab
    scheduleSessions: "Записаться на сессию",
    selectDate: "Выберите дату",
    availableTimes: "Доступное время",
    noSlotsAvailable: "Нет доступных слотов на эту дату",
    selectSessionType: "Выберите тип сессии для просмотра доступного времени",
    group: "Групповой",
    individual: "Индивидуальный",
    upToParticipants: "До {count} участников",
    noPurchasedProducts: "Нет купленных продуктов с расписанием",
    purchaseForSchedule: "Купите продукт для доступа к записи",
    noSchedules: "Расписание недоступно",
    noSchedulesEnabled: "Для этого продукта запись не включена",
    bookingConfirmed: "Запись подтверждена!",
    bookingFailed: "Не удалось записаться",
    myBookings: "Мои записи",
    noBookingsStudent: "У вас пока нет записей",
    cancelBooking: "Отменить запись",
    bookingCancelled: "Запись отменена",
    cancelFailed: "Не удалось отменить запись",
    
    // Account Tab
    profile: "Профиль",
    memberSince: "Участник с",
    myPurchases: "Мои покупки",
    purchased: "Куплено",
    noPurchases: "Покупок пока нет",
    
    // Creator Dashboard
    shareLink: "Поделиться ссылкой",
    copyLink: "Копировать ссылку",
    linkCopied: "Ссылка скопирована!",
    productLink: "Ссылка на продукт",
    noProducts: "Продуктов пока нет",
    createFirstProduct: "Создайте свой первый продукт",
    
    // Creator Users Tab
    paidUsers: "Оплатившие пользователи",
    noPaidUsers: "Пока нет оплативших пользователей",
    usersWillAppear: "Пользователи появятся здесь после оплаты",
    phone: "Телефон",
    notProvided: "Не указано",
    
    // Creator Schedule Tab
    weeklySchedule: "Расписание на неделю",
    noBookings: "Нет записей",
    noBookingsYet: "Записи появятся здесь",
    bookingsFor: "Записи на",
    
    // Index page
    welcome: "Добро пожаловать",
    viewDemoProduct: "Посмотреть демо продукт",
    goToDashboard: "Перейти в кабинет",
    creatorPanel: "Панель создателя",
    
    // Language
    language: "Язык",
    russian: "Русский",
    kazakh: "Қазақша",
    
    // New translations for role selection
    selectRole: "Выберите роль",
    student: "Учащийся",
    studentDescription: "Доступ к купленным курсам и материалам",
    courseCreator: "Создатель курса",
    creatorDescription: "Создавайте и продавайте свои курсы",
    
    // Creator login
    creatorLogin: "Вход для создателя",
    creatorPassword: "Пароль создателя",
    enterPassword: "Введите пароль",
    welcomeCreator: "Добро пожаловать, создатель!",
    wrongPassword: "Неверный пароль",
    
    // Purchase flow
    waitingForConfirmation: "Ожидание подтверждения",
    waitingDescription: "Ваш заказ обрабатывается. После подтверждения оплаты создателем курса, доступ откроется автоматически.",
    sendReceiptWarning: "После оплаты через Kaspi, пожалуйста, отправьте чек автору курса — иначе доступ на платформу не откроется.",
    sendReceiptInfo: "Отправьте чек об оплате автору курса для подтверждения доступа.",
    accessGranted: "Доступ открыт!",
    
    // Creator actions
    confirmPayment: "Подтвердить оплату",
    pendingPayments: "Ожидающие подтверждения",
    kaspiLink: "Ссылка Kaspi",
    kaspiLinkPlaceholder: "https://kaspi.kz/pay/...",
    paymentConfirmed: "Оплата подтверждена!",
    searchUsers: "Поиск пользователей...",
    amount: "Сумма",
    total: "всего",
  },
  kk: {
    // Common
    back: "Артқа",
    loading: "Жүктелуде...",
    signOut: "Шығу",
    signIn: "Кіру",
    processing: "Өңделуде...",
    save: "Сақтау",
    cancel: "Бас тарту",
    delete: "Жою",
    edit: "Өңдеу",
    add: "Қосу",
    create: "Жасау",
    view: "Қарау",
    close: "Жабу",
    confirm: "Растау",
    oneTime: "бір рет",
    continue: "Жалғастыру",
    
    // Navigation
    materials: "Материалдар",
    schedule: "Кесте",
    account: "Аккаунт",
    products: "Өнімдер",
    users: "Пайдаланушылар",
    
    // Product Page
    getAccess: "Қол жеткізу",
    
    // Checkout
    orderSummary: "Тапсырыс жиынтығы",
    secureCheckout: "Қауіпсіз төлем",
    email: "Электрондық пошта",
    emailPlaceholder: "сіз@example.com",
    fullName: "Толық аты-жөні",
    namePlaceholder: "Сіздің атыңыз",
    payWithKaspi: "Kaspi арқылы төлеу",
    kaspiPaymentInfo: "Kaspi-де төлегеннен кейін төмендегі түймені басыңыз",
    paidContinue: "Төледім, жалғастыру",
    noPaymentMethod: "Төлем әдісі орнатылмаған",
    termsAgreement: "Төлем жасау арқылы сіз біздің қызмет шарттарымен келісесіз.",
    
    // Password Setup
    paymentSuccessful: "Төлем сәтті өтті!",
    setupPassword: "Сатып алуға қол жеткізу үшін құпия сөзді орнатыңыз",
    createAccount: "Аккаунт жасау",
    loggedInAs: "Кіру:",
    password: "Құпия сөз",
    createPassword: "Құпия сөз жасаңыз",
    confirmPassword: "Құпия сөзді растаңыз",
    confirmPasswordPlaceholder: "Құпия сөзіңізді растаңыз",
    passwordMinLength: "Құпия сөз кемінде 8 таңбадан тұруы керек",
    passwordsNotMatch: "Құпия сөздер сәйкес келмейді",
    creatingAccount: "Аккаунт жасалуда...",
    accessPurchase: "Сатып алуға қол жеткізу",
    
    // Auth Page
    signInTitle: "Кіру",
    signInDescription: "Сатып алуларыңызға қол жеткізіңіз",
    yourPassword: "Сіздің құпия сөзіңіз",
    signingIn: "Кіру...",
    noAccount: "Аккаунтыңыз жоқ па? Қол жеткізу үшін өнім сатып алыңыз.",
    
    // Dashboard
    myDashboard: "Менің кабинетім",
    creatorDashboard: "Автор панелі",
    
    // Materials Tab
    myMaterials: "Менің материалдарым",
    noMaterials: "Материалдар әзірге жоқ",
    purchaseToAccess: "Материалдарға қол жеткізу үшін өнім сатып алыңыз",
    
    // Schedule Tab
    scheduleSessions: "Сессияға жазылу",
    selectDate: "Күнді таңдаңыз",
    availableTimes: "Қолжетімді уақыт",
    noSlotsAvailable: "Бұл күнге слоттар жоқ",
    selectSessionType: "Қолжетімді уақытты көру үшін сессия түрін таңдаңыз",
    group: "Топтық",
    individual: "Жеке",
    upToParticipants: "{count} қатысушыға дейін",
    noPurchasedProducts: "Кестесі бар сатып алынған өнімдер жоқ",
    purchaseForSchedule: "Жазылу үшін өнім сатып алыңыз",
    noSchedules: "Кесте қолжетімсіз",
    noSchedulesEnabled: "Бұл өнім үшін жазылу қосылмаған",
    bookingConfirmed: "Жазылу расталды!",
    bookingFailed: "Жазылу сәтсіз аяқталды",
    myBookings: "Менің жазылуларым",
    noBookingsStudent: "Сізде әзірге жазылулар жоқ",
    cancelBooking: "Жазылуды болдырмау",
    bookingCancelled: "Жазылу болдырмалды",
    cancelFailed: "Жазылуды болдырмау сәтсіз",
    
    // Account Tab
    profile: "Профиль",
    memberSince: "Мүше болған күн",
    myPurchases: "Менің сатып алуларым",
    purchased: "Сатып алынды",
    noPurchases: "Сатып алулар әзірге жоқ",
    
    // Creator Dashboard
    shareLink: "Сілтемемен бөлісу",
    copyLink: "Сілтемені көшіру",
    linkCopied: "Сілтеме көшірілді!",
    productLink: "Өнім сілтемесі",
    noProducts: "Өнімдер әзірге жоқ",
    createFirstProduct: "Бірінші өніміңізді жасаңыз",
    
    // Creator Users Tab
    paidUsers: "Төлеген пайдаланушылар",
    noPaidUsers: "Төлеген пайдаланушылар әзірге жоқ",
    usersWillAppear: "Пайдаланушылар төлегеннен кейін мұнда пайда болады",
    phone: "Телефон",
    notProvided: "Көрсетілмеген",
    
    // Creator Schedule Tab
    weeklySchedule: "Апталық кесте",
    noBookings: "Жазылулар жоқ",
    noBookingsYet: "Жазылулар мұнда пайда болады",
    bookingsFor: "Жазылулар:",
    
    // Index page
    welcome: "Қош келдіңіз",
    viewDemoProduct: "Демо өнімді қарау",
    goToDashboard: "Кабинетке өту",
    creatorPanel: "Автор панелі",
    
    // Language
    language: "Тіл",
    russian: "Русский",
    kazakh: "Қазақша",
    
    // New translations for role selection
    selectRole: "Рөлді таңдаңыз",
    student: "Оқушы",
    studentDescription: "Сатып алынған курстар мен материалдарға қол жеткізу",
    courseCreator: "Курс авторы",
    creatorDescription: "Өз курстарыңызды жасаңыз және сатыңыз",
    
    // Creator login
    creatorLogin: "Автор үшін кіру",
    creatorPassword: "Автор құпия сөзі",
    enterPassword: "Құпия сөзді енгізіңіз",
    welcomeCreator: "Қош келдіңіз, автор!",
    wrongPassword: "Құпия сөз қате",
    
    // Purchase flow
    waitingForConfirmation: "Растауды күту",
    waitingDescription: "Тапсырысыңыз өңделуде. Курс авторы төлемді растағаннан кейін қол жеткізу автоматты түрде ашылады.",
    sendReceiptWarning: "Kaspi арқылы төлегеннен кейін, чекті курс авторына жіберіңіз — әйтпесе платформаға қол жеткізу ашылмайды.",
    sendReceiptInfo: "Қол жеткізуді растау үшін төлем чегін курс авторына жіберіңіз.",
    accessGranted: "Қол жеткізу ашылды!",
    
    // Creator actions
    confirmPayment: "Төлемді растау",
    pendingPayments: "Растауды күтуде",
    kaspiLink: "Kaspi сілтемесі",
    kaspiLinkPlaceholder: "https://kaspi.kz/pay/...",
    paymentConfirmed: "Төлем расталды!",
    searchUsers: "Пайдаланушыларды іздеу...",
    amount: "Сома",
    total: "барлығы",
  },
} as const;

export type TranslationKey = keyof typeof translations.ru;
