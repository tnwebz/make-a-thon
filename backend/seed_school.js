const { User, SchoolClass, sequelize } = require('./models');
const bcrypt = require('bcrypt');

async function seedSchool() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');
        await sequelize.sync({ alter: true });
        console.log('Database synced.');

        const getPasswordHash = async (password) => {
            const salt = await bcrypt.genSalt(10);
            return await bcrypt.hash(password, salt);
        };
        const passwordHash = await getPasswordHash('123');

        // Create Admin
        await User.findOrCreate({
            where: { email: 'admin@skillforge.com' },
            defaults: {
                full_name: 'Super Admin',
                hashed_password: passwordHash,
                role: 'admin',
                status: 'Active',
                temp_password: '123'
            }
        });
        console.log('✅ Admin user created: admin@skillforge.com / 123');

        // Create Classes
        const classesData = [
            { name: 'Class 10', academic_year: '2024-2025' },
            { name: 'Class 11', academic_year: '2024-2025' },
            { name: 'Class 12', academic_year: '2024-2025' }
        ];
        
        const createdClasses = [];
        for (const c of classesData) {
            const [schoolClass] = await SchoolClass.findOrCreate({
                where: { name: c.name },
                defaults: c
            });
            createdClasses.push(schoolClass);
        }
        console.log('✅ Classes seeded');

        // Create Staff
        for (let i = 1; i <= 5; i++) {
            await User.findOrCreate({
                where: { email: `staff${i}@skillforge.com` },
                defaults: {
                    full_name: `Staff Member ${i}`,
                    hashed_password: passwordHash,
                    role: 'instructor',
                    status: 'Active',
                    temp_password: '123'
                }
            });
        }
        console.log('✅ 5 Staff members seeded (staff1@... to staff5@...)');

        // Create Students
        const sections = ['A', 'B', 'C'];
        let studentCount = 1;
        for (const cls of createdClasses) {
            for (const section of sections) {
                // Add 3-4 students per section (approx 30 total)
                for (let i = 1; i <= 3; i++) {
                    await User.findOrCreate({
                        where: { email: `student${studentCount}@skillforge.com` },
                        defaults: {
                            full_name: `Student ${studentCount} (${cls.name} ${section})`,
                            hashed_password: passwordHash,
                            role: 'student',
                            status: 'Active',
                            temp_password: '123',
                            school_class_id: cls.id,
                            section: section
                        }
                    });
                    studentCount++;
                }
            }
        }
        console.log(`✅ ${studentCount - 1} Students seeded`);
    } catch (error) {
        console.error('Error seeding:', error);
    } finally {
        await sequelize.close();
    }
}

seedSchool();
