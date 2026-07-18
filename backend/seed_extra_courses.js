const { Course, SchoolClass, User, CourseBatch, Enrollment, Module, ContentItem } = require('./models');
const sequelize = require('./models').sequelize;

async function seed() {
    try {
        const classes = await SchoolClass.findAll();
        const classIds = classes.map(c => c.id);
        
        if (classIds.length === 0) {
            console.log("No classes found.");
            return;
        }

        const instructors = await User.findAll({ where: { role: 'instructor' } });
        if (instructors.length === 0) {
            console.log("No instructors found.");
            return;
        }
        const instructor = instructors[0];

        const coursesData = [
            { title: "HTML Fundamentals", description: "Learn the basics of HTML5.", price: 0, image_url: "https://images.unsplash.com/photo-1618331835717-801e976710b2", is_published: true, is_finalized: false },
            { title: "Advanced CSS", description: "Master flexbox, grid, and animations.", price: 0, image_url: "https://images.unsplash.com/photo-1507721999472-8ed4421c4af2", is_published: true, is_finalized: false },
            { title: "JavaScript Mastery", description: "Deep dive into JS ES6+.", price: 0, image_url: "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a", is_published: true, is_finalized: false },
            { title: "React Development", description: "Build modern web apps with React.", price: 0, image_url: "https://images.unsplash.com/photo-1633356122544-f134324a6cee", is_published: true, is_finalized: false },
            { title: "AWS Cloud Practitioner", description: "Start your cloud journey.", price: 0, image_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa", is_published: true, is_finalized: false },
        ];

        // Delete old seeded courses
        await Course.destroy({ where: { title: coursesData.map(c => c.title) } });

        let i = 0;
        for (const cData of coursesData) {
            const cls = classIds[i % classIds.length]; // distribute among classes
            
            const course = await Course.create({
                ...cData,
                instructor_id: instructor.id,
                school_class_id: cls
            });

            // Create a batch
            const batch = await CourseBatch.create({
                course_id: course.id,
                name: "Batch A - " + cData.title,
                school_class_id: cls,
                instructor_id: instructor.id,
                section: "A"
            });

            // Create Modules and Content
            const module1 = await Module.create({ title: "Getting Started", description: "Introduction to the topic.", order: 1, course_id: course.id });
            const module2 = await Module.create({ title: "Deep Dive", description: "Advanced concepts.", order: 2, course_id: course.id });

            await ContentItem.create({ title: "Welcome Video", type: "video", content: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration: 5, is_mandatory: true, order: 1, module_id: module1.id });
            await ContentItem.create({ title: "Course Notes", type: "note", content: "https://docs.google.com/document/d/1X5X.../view", duration: 10, is_mandatory: false, order: 2, module_id: module1.id });
            
            await ContentItem.create({ title: "Advanced Topics Video", type: "video", content: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration: 25, is_mandatory: true, order: 1, module_id: module2.id });
            await ContentItem.create({ title: "Final Assessment", type: "quiz", content: "https://docs.google.com/forms/d/e/1FAI.../viewform", duration: 15, is_mandatory: true, order: 2, module_id: module2.id });

            // Enroll 3 random students from this class
            const students = await User.findAll({ where: { role: 'student', school_class_id: cls }, limit: 3 });
            for (const student of students) {
                await Enrollment.create({
                    user_id: student.id,
                    course_id: course.id,
                    batch_id: batch.id,
                    progress_percentage: 0
                });
            }

            console.log(`Created course ${course.title} and enrolled ${students.length} students.`);
            i++;
        }
        
        console.log("Seeding complete!");
    } catch (e) {
        console.error(e);
    }
}

seed();
