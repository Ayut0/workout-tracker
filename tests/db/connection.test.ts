import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

async function main() {
	const result = await prisma.$queryRaw`SELECT 1`;
	console.log("DB connected:", result);
}

main()
	.catch(console.error)
	.finally(async () => {
		await prisma.$disconnect();
	});

