const { User, sequelize } = require('./models');
const bcrypt = require('bcrypt');

async function seedUsers() {
    try {
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully.');

        const getPasswordHash = async (password) => {
            const salt = await bcrypt.genSalt(10);
            return await bcrypt.hash(password, salt);
        };

        const passwordHash = await getPasswordHash('123');

        // Seed / Update Student: student@gmail.com / 123
        const [student, createdStudent] = await User.findOrCreate({
            where: { email: 'student@gmail.com' },
            defaults: {
                full_name: 'Student Learner',
                hashed_password: passwordHash,
                role: 'student',
                status: 'Active',
                temp_password: '123'
            }
        });
        if (!createdStudent) {
            await student.update({ hashed_password: passwordHash, status: 'Active', role: 'student' });
            console.log('🔄 Student user updated: student@gmail.com');
        } else {
            console.log('✅ Student user created: student@gmail.com');
        }

        // Seed / Update Student 2: student2@gmail.com / 123
        const [student2, createdStudent2] = await User.findOrCreate({
            where: { email: 'student2@gmail.com' },
            defaults: {
                full_name: 'Student Learner 2',
                hashed_password: passwordHash,
                role: 'student',
                status: 'Active',
                temp_password: '123'
            }
        });
        if (!createdStudent2) {
            await student2.update({ hashed_password: passwordHash, status: 'Active', role: 'student' });
            console.log('🔄 Student user updated: student2@gmail.com');
        } else {
            console.log('✅ Student user created: student2@gmail.com');
        }

        // Seed / Update Instructor: staff@gmail.com / 123
        const [instructor, createdInstructor] = await User.findOrCreate({
            where: { email: 'staff@gmail.com' },
            defaults: {
                full_name: 'Staff Instructor',
                hashed_password: passwordHash,
                role: 'instructor',
                status: 'Active',
                temp_password: '123'
            }
        });
        if (!createdInstructor) {
            await instructor.update({ hashed_password: passwordHash, status: 'Active', role: 'instructor' });
            console.log('🔄 Instructor user updated: staff@gmail.com');
        } else {
            console.log('✅ Instructor user created: staff@gmail.com');
        }

        // Seed / Update Instructor: admin@gmail.com / 123
        const [adminInstructor, createdAdminInstructor] = await User.findOrCreate({
            where: { email: 'admin@gmail.com' },
            defaults: {
                full_name: 'Admin Instructor',
                hashed_password: passwordHash,
                role: 'instructor',
                status: 'Active',
                temp_password: '123'
            }
        });
        if (!createdAdminInstructor) {
            await adminInstructor.update({ hashed_password: passwordHash, status: 'Active', role: 'instructor' });
            console.log('🔄 Instructor user updated: admin@gmail.com');
        } else {
            console.log('✅ Instructor user created: admin@gmail.com');
        }

    } catch (error) {
        console.error('❌ Error seeding database users:', error);
    } finally {
        await sequelize.close();
    }
}

seedUsers();
