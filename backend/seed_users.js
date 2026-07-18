const { User, sequelize } = require('./models');
const bcrypt = require('bcrypt');

async function seedUsers() {
    try {
        // Ensure database connection
        await sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully.');

        // Function to hash password
        const getPasswordHash = async (password) => {
            const salt = await bcrypt.genSalt(10);
            return await bcrypt.hash(password, salt);
        };

        const passwordHash = await getPasswordHash('123');

        // Create Student
        const [student, createdStudent] = await User.findOrCreate({
            where: { email: 'student@gmail.com' },
            defaults: {
                full_name: 'Test Student',
                hashed_password: passwordHash,
                role: 'student',
                status: 'Active',
                temp_password: '123'
            }
        });

        if (createdStudent) {
            console.log('✅ Student user created: student@gmail.com');
        } else {
            console.log('⚠️ Student user already exists.');
        }

        // Create Instructor
        const [instructor, createdInstructor] = await User.findOrCreate({
            where: { email: 'admin@gmail.com' },
            defaults: {
                full_name: 'Test Instructor',
                hashed_password: passwordHash,
                role: 'instructor',
                status: 'Active',
                temp_password: '123'
            }
        });

        if (createdInstructor) {
            console.log('✅ Instructor user created: admin@gmail.com');
        } else {
            console.log('⚠️ Instructor user already exists.');
        }

    } catch (error) {
        console.error('❌ Unable to connect to the database or create users:', error);
    } finally {
        // Close the connection
        await sequelize.close();
    }
}

seedUsers();
