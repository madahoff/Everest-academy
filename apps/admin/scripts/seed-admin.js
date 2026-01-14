const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@everest.pro';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ACTIVE',
        },
        create: {
            email,
            name: 'Admin Everest',
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ACTIVE',
            image: 'https://ui-avatars.com/api/?name=Admin+Everest&background=0D8ABC&color=fff',
        },
    });

    console.log({ user });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
