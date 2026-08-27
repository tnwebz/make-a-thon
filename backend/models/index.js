require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const { URL } = require('url');

let sequelize;

if (process.env.DATABASE_URL) {
    let databaseUrl = process.env.DATABASE_URL;
    try {
        const parsedUrl = new URL(databaseUrl);
        if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
            parsedUrl.pathname = '/skillforge_db';
            databaseUrl = parsedUrl.toString();
        }
    } catch (e) {
        console.error('Error parsing DATABASE_URL:', e);
    }
    sequelize = new Sequelize(databaseUrl, {
        dialect: 'postgres',
        logging: false
    });
} else {
    sequelize = new Sequelize('skillforge_db', 'postgres', '0728', {
        host: 'localhost',
        dialect: 'postgres',
        logging: false
    });
}

const User = sequelize.define('User', {
    email: { type: DataTypes.STRING, unique: true },
    phone_number: { type: DataTypes.STRING, allowNull: true },
    full_name: { type: DataTypes.STRING },
    hashed_password: { type: DataTypes.STRING },
    role: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: "Active" },
    temp_password: { type: DataTypes.STRING, allowNull: true },
    zoom_account_id: { type: DataTypes.STRING, allowNull: true },
    zoom_client_id: { type: DataTypes.STRING, allowNull: true },
    zoom_client_secret: { type: DataTypes.STRING, allowNull: true },
    school_class_id: { type: DataTypes.INTEGER, allowNull: true },
    section: { type: DataTypes.STRING, allowNull: true },
    profile_pic: { type: DataTypes.TEXT, allowNull: true },
}, { timestamps: true, tableName: 'users' });

const SchoolClass = sequelize.define('SchoolClass', {
    name: { type: DataTypes.STRING, allowNull: false },
    academic_year: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: true, tableName: 'school_classes' });

const Course = sequelize.define('Course', {
    title: { type: DataTypes.STRING },
    description: { type: DataTypes.STRING },
    price: { type: DataTypes.INTEGER },
    image_url: { type: DataTypes.TEXT, allowNull: true },
    is_published: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_finalized: { type: DataTypes.BOOLEAN, defaultValue: false },
    school_class_id: { type: DataTypes.INTEGER, allowNull: true },
}, { timestamps: false, tableName: 'courses' });

const CourseBatch = sequelize.define('CourseBatch', {
    name: { type: DataTypes.STRING, allowNull: false },
    section: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: true, tableName: 'course_batches' });

const Module = sequelize.define('Module', {
    title: { type: DataTypes.STRING },
    order: { type: DataTypes.INTEGER },
}, { timestamps: false, tableName: 'modules' });

const ContentItem = sequelize.define('ContentItem', {
    title: { type: DataTypes.STRING },
    type: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT, allowNull: true },
    duration: { type: DataTypes.INTEGER, allowNull: true },
    is_mandatory: { type: DataTypes.BOOLEAN, defaultValue: false },
    order: { type: DataTypes.INTEGER },
    instructions: { type: DataTypes.TEXT, allowNull: true },
    test_config: { type: DataTypes.TEXT, allowNull: true },
}, { timestamps: false, tableName: 'content_items' });

const Enrollment = sequelize.define('Enrollment', {
    enrollment_type: { type: DataTypes.STRING, defaultValue: "paid" },
    expiry_date: { type: DataTypes.DATE, allowNull: true },
    enrolled_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    batch_id: { type: DataTypes.INTEGER, allowNull: true },
}, { timestamps: false, tableName: 'enrollments' });

const Submission = sequelize.define('Submission', {
    drive_link: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: "Pending" },
    submitted_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
}, { timestamps: false, tableName: 'submissions' });

const CodeTest = sequelize.define('CodeTest', {
    title: { type: DataTypes.STRING },
    pass_key: { type: DataTypes.STRING },
    time_limit: { type: DataTypes.INTEGER },
}, { timestamps: true, tableName: 'code_tests' });

const Problem = sequelize.define('Problem', {
    title: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    difficulty: { type: DataTypes.STRING },
    test_cases: { type: DataTypes.TEXT },
}, { timestamps: false, tableName: 'problems' });

const TestResult = sequelize.define('TestResult', {
    score: { type: DataTypes.INTEGER },
    problems_solved: { type: DataTypes.INTEGER },
    time_taken: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: "submitted" },
    submitted_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
}, { timestamps: false, tableName: 'test_results' });

const LessonProgress = sequelize.define('LessonProgress', {
    completed_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
}, { timestamps: false, tableName: 'lesson_progress' });

const ScheduledClass = sequelize.define('ScheduledClass', {
    title: { type: DataTypes.STRING },
    agenda: { type: DataTypes.TEXT, allowNull: true },
    start_time: { type: DataTypes.DATE },
    duration_minutes: { type: DataTypes.INTEGER },
    meeting_link: { type: DataTypes.STRING, allowNull: true },
    meeting_id: { type: DataTypes.STRING, allowNull: true },
}, { timestamps: true, tableName: 'scheduled_classes' });

const CourseReview = sequelize.define('CourseReview', {
    rating: { type: DataTypes.INTEGER },
    feedback: { type: DataTypes.TEXT, allowNull: true },
}, { timestamps: true, tableName: 'course_reviews' });

const ShareSession = sequelize.define('ShareSession', {
    shareCode: { type: DataTypes.STRING(10), unique: true, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    createdById: { type: DataTypes.INTEGER, allowNull: false },
    accessMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'VIEW_ONLY' }, // VIEW_ONLY | ALLOW_DOWNLOAD
    passkeyHash: { type: DataTypes.STRING, allowNull: false },
    passkeyPlain: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVE' }, // ACTIVE | REVOKED | EXPIRED
    expiresAt: { type: DataTypes.DATE, allowNull: true },
}, { timestamps: true, tableName: 'share_sessions' });

const CourseVersion = sequelize.define('CourseVersion', {
    course_id: { type: DataTypes.INTEGER, allowNull: false },
    language_code: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'hi' },
    title: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'NOT_GENERATED' }, // NOT_GENERATED | GENERATING | READY | FAILED | OUTDATED
    progress: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_files: { type: DataTypes.INTEGER, defaultValue: 0 },
    completed_files: { type: DataTypes.INTEGER, defaultValue: 0 },
    current_file: { type: DataTypes.STRING, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
}, { timestamps: true, tableName: 'course_versions' });

const ContentItemTranslation = sequelize.define('ContentItemTranslation', {
    content_item_id: { type: DataTypes.INTEGER, allowNull: false },
    language_code: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'hi' },
    title: { type: DataTypes.STRING, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: true }, // URL or /uploads/media/hi/ path to translated PDF
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'READY' }, // READY | FAILED | GENERATING | OUTDATED
    source_checksum: { type: DataTypes.STRING, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    instructions: { type: DataTypes.TEXT, allowNull: true },
}, { timestamps: true, tableName: 'content_item_translations' });

const VideoSubtitle = sequelize.define('VideoSubtitle', {
    content_item_id: { type: DataTypes.INTEGER, allowNull: false },
    language_code: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'hi' },
    vtt_path: { type: DataTypes.TEXT, allowNull: true },        // /uploads/media/subtitles/hi/xxx.vtt
    transcript_path: { type: DataTypes.TEXT, allowNull: true },  // /uploads/media/subtitles/hi/xxx.json
    status: { type: DataTypes.STRING, defaultValue: 'READY' },   // READY | FAILED | GENERATING
    segment_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    duration_seconds: { type: DataTypes.FLOAT, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
}, { timestamps: true, tableName: 'video_subtitles' });

const VideoDubbedAsset = sequelize.define('VideoDubbedAsset', {
    content_item_id: { type: DataTypes.INTEGER, allowNull: false },
    course_id: { type: DataTypes.INTEGER, allowNull: true },
    language_code: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ta' },
    dubbed_video_path: { type: DataTypes.TEXT, allowNull: true }, // /uploads/media/dubbed/ta/xxx_ta.mp4
    voice_audio_path: { type: DataTypes.TEXT, allowNull: true },  // /uploads/media/dubbed/ta/xxx_ta_voice.wav
    reference_voice_path: { type: DataTypes.TEXT, allowNull: true }, // /uploads/media/ref_voices/xxx_ref.wav
    reference_transcript: { type: DataTypes.TEXT, allowNull: true },
    reference_mode: { type: DataTypes.STRING(20), defaultValue: 'auto' }, // 'auto' | 'manual'
    ref_start_time: { type: DataTypes.FLOAT, allowNull: true },
    ref_end_time: { type: DataTypes.FLOAT, allowNull: true },
    status: { type: DataTypes.STRING, defaultValue: 'READY' }, // READY | FAILED | GENERATING | NOT_GENERATED
    progress: { type: DataTypes.INTEGER, defaultValue: 0 },
    error_message: { type: DataTypes.TEXT, allowNull: true },
}, { timestamps: true, tableName: 'video_dubbed_assets' });

// ============================================
// 📝 MANUAL QUIZ & MULTILINGUAL QUIZ MODELS
// ============================================

const Quiz = sequelize.define('Quiz', {
    content_item_id: { type: DataTypes.INTEGER, allowNull: false },
    course_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    quiz_type: { type: DataTypes.STRING, defaultValue: 'manual' }, // 'manual' | 'external'
    duration_minutes: { type: DataTypes.INTEGER, defaultValue: 15 },
    is_mandatory: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
}, { timestamps: true, tableName: 'quizzes' });

const QuizQuestion = sequelize.define('QuizQuestion', {
    quiz_id: { type: DataTypes.INTEGER, allowNull: false },
    question_text: { type: DataTypes.TEXT, allowNull: false },
    order_index: { type: DataTypes.INTEGER, defaultValue: 1 },
    correct_option_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // 0, 1, 2, or 3
}, { timestamps: true, tableName: 'quiz_questions' });

const QuizOption = sequelize.define('QuizOption', {
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    option_text: { type: DataTypes.TEXT, allowNull: false },
    option_index: { type: DataTypes.INTEGER, allowNull: false }, // 0, 1, 2, or 3
}, { timestamps: true, tableName: 'quiz_options' });

const QuizQuestionTranslation = sequelize.define('QuizQuestionTranslation', {
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    language_code: { type: DataTypes.STRING(10), allowNull: false }, // 'hi', 'ta'
    translated_text: { type: DataTypes.TEXT, allowNull: false },
    source_checksum: { type: DataTypes.STRING, allowNull: true },
}, { timestamps: true, tableName: 'quiz_question_translations' });

const QuizOptionTranslation = sequelize.define('QuizOptionTranslation', {
    option_id: { type: DataTypes.INTEGER, allowNull: false },
    language_code: { type: DataTypes.STRING(10), allowNull: false }, // 'hi', 'ta'
    translated_text: { type: DataTypes.TEXT, allowNull: false },
    source_checksum: { type: DataTypes.STRING, allowNull: true },
}, { timestamps: true, tableName: 'quiz_option_translations' });

const QuizResult = sequelize.define('QuizResult', {
    quiz_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    score: { type: DataTypes.INTEGER, allowNull: false },
    total_questions: { type: DataTypes.INTEGER, allowNull: false },
    percentage: { type: DataTypes.INTEGER, allowNull: false },
    selected_answers: { type: DataTypes.TEXT, allowNull: true }, // JSON map: { [question_id]: selected_option_index }
    language_code: { type: DataTypes.STRING(10), defaultValue: 'en' },
    status: { type: DataTypes.STRING, defaultValue: 'COMPLETED' },
    submitted_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
}, { timestamps: true, tableName: 'quiz_results' });

// Setup Relationships
SchoolClass.hasMany(User, { foreignKey: 'school_class_id', as: 'students' });
User.belongsTo(SchoolClass, { foreignKey: 'school_class_id', as: 'schoolClass' });

User.hasMany(Course, { foreignKey: 'instructor_id', as: 'instructorCourses' });
Course.belongsTo(User, { foreignKey: 'instructor_id', as: 'instructor' });

Course.hasMany(Module, { foreignKey: 'course_id' });
Module.belongsTo(Course, { foreignKey: 'course_id' });

Module.hasMany(ContentItem, { foreignKey: 'module_id', as: 'items' });
ContentItem.belongsTo(Module, { foreignKey: 'module_id' });

Course.hasMany(CourseVersion, { foreignKey: 'course_id', as: 'versions' });
CourseVersion.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

ContentItem.hasMany(ContentItemTranslation, { foreignKey: 'content_item_id', as: 'translations' });
ContentItemTranslation.belongsTo(ContentItem, { foreignKey: 'content_item_id', as: 'contentItem' });

ContentItem.hasMany(VideoSubtitle, { foreignKey: 'content_item_id', as: 'subtitles' });
VideoSubtitle.belongsTo(ContentItem, { foreignKey: 'content_item_id', as: 'contentItem' });

ContentItem.hasMany(VideoDubbedAsset, { foreignKey: 'content_item_id', as: 'dubbed_assets' });
VideoDubbedAsset.belongsTo(ContentItem, { foreignKey: 'content_item_id', as: 'contentItem' });

// Quiz Relationships
ContentItem.hasOne(Quiz, { foreignKey: 'content_item_id', as: 'quiz' });
Quiz.belongsTo(ContentItem, { foreignKey: 'content_item_id', as: 'contentItem' });

Course.hasMany(Quiz, { foreignKey: 'course_id', as: 'quizzes' });
Quiz.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Quiz.hasMany(QuizQuestion, { foreignKey: 'quiz_id', as: 'questions' });
QuizQuestion.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

QuizQuestion.hasMany(QuizOption, { foreignKey: 'question_id', as: 'options' });
QuizOption.belongsTo(QuizQuestion, { foreignKey: 'question_id', as: 'question' });

QuizQuestion.hasMany(QuizQuestionTranslation, { foreignKey: 'question_id', as: 'translations' });
QuizQuestionTranslation.belongsTo(QuizQuestion, { foreignKey: 'question_id', as: 'question' });

QuizOption.hasMany(QuizOptionTranslation, { foreignKey: 'option_id', as: 'translations' });
QuizOptionTranslation.belongsTo(QuizOption, { foreignKey: 'option_id', as: 'option' });

Quiz.hasMany(QuizResult, { foreignKey: 'quiz_id', as: 'results' });
QuizResult.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

User.hasMany(QuizResult, { foreignKey: 'user_id', as: 'quiz_results' });
QuizResult.belongsTo(User, { foreignKey: 'user_id', as: 'student' });

User.hasMany(Enrollment, { foreignKey: 'user_id', as: 'enrollments' });
Enrollment.belongsTo(User, { foreignKey: 'user_id', as: 'student' });
Course.hasMany(Enrollment, { foreignKey: 'course_id', as: 'enrollments' });
Enrollment.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// CourseBatch Relationships
Course.hasMany(CourseBatch, { foreignKey: 'course_id', as: 'batches' });
CourseBatch.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
SchoolClass.hasMany(CourseBatch, { foreignKey: 'school_class_id', as: 'batches' });
CourseBatch.belongsTo(SchoolClass, { foreignKey: 'school_class_id', as: 'schoolClass' });
CourseBatch.hasMany(Enrollment, { foreignKey: 'batch_id', as: 'enrollments' });
Enrollment.belongsTo(CourseBatch, { foreignKey: 'batch_id', as: 'batch' });
Course.belongsTo(SchoolClass, { foreignKey: 'school_class_id', as: 'schoolClass' });
SchoolClass.hasMany(Course, { foreignKey: 'school_class_id', as: 'courses' });

User.hasMany(Submission, { foreignKey: 'user_id', as: 'submissions' });
Submission.belongsTo(User, { foreignKey: 'user_id', as: 'student' });
ContentItem.hasMany(Submission, { foreignKey: 'content_item_id' });
Submission.belongsTo(ContentItem, { foreignKey: 'content_item_id', as: 'assignment' });

User.hasMany(CodeTest, { foreignKey: 'instructor_id' });
CodeTest.belongsTo(User, { foreignKey: 'instructor_id' });

CodeTest.hasMany(Problem, { foreignKey: 'test_id', as: 'problems' });
Problem.belongsTo(CodeTest, { foreignKey: 'test_id', as: 'test' });

User.hasMany(TestResult, { foreignKey: 'user_id', as: 'test_results' });
TestResult.belongsTo(User, { foreignKey: 'user_id', as: 'student' });
CodeTest.hasMany(TestResult, { foreignKey: 'test_id', as: 'results' });
TestResult.belongsTo(CodeTest, { foreignKey: 'test_id', as: 'test' });

User.hasMany(LessonProgress, { foreignKey: 'user_id' });
LessonProgress.belongsTo(User, { foreignKey: 'user_id' });
ContentItem.hasMany(LessonProgress, { foreignKey: 'content_item_id' });
LessonProgress.belongsTo(ContentItem, { foreignKey: 'content_item_id' });

ScheduledClass.belongsTo(User, { foreignKey: 'instructor_id', as: 'instructor' });
Course.hasMany(ScheduledClass, { foreignKey: 'course_id' });
ScheduledClass.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

User.hasMany(CourseReview, { foreignKey: 'user_id' });
CourseReview.belongsTo(User, { foreignKey: 'user_id', as: 'student' });
Course.hasMany(CourseReview, { foreignKey: 'course_id' });
CourseReview.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// ShareSession Relationships
Course.hasMany(ShareSession, { foreignKey: 'courseId', as: 'shareSessions' });
ShareSession.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
User.hasMany(ShareSession, { foreignKey: 'createdById', as: 'shareSessions' });
ShareSession.belongsTo(User, { foreignKey: 'createdById', as: 'creator' });

module.exports = {
    sequelize,
    User,
    SchoolClass,
    Course,
    CourseBatch,
    Module,
    ContentItem,
    CourseVersion,
    ContentItemTranslation,
    VideoSubtitle,
    VideoDubbedAsset,
    Quiz,
    QuizQuestion,
    QuizOption,
    QuizQuestionTranslation,
    QuizOptionTranslation,
    QuizResult,
    Enrollment,
    Submission,
    CodeTest,
    Problem,
    TestResult,
    LessonProgress,
    ScheduledClass,
    CourseReview,
    ShareSession
};

