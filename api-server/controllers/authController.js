const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');

const prisma = new PrismaClient();

const checkUser = async (req, res) => {
    const schema = z.object({
        email: z.string().email(),
    });
    const parsedResult = schema.safeParse(req.body);
    if (!parsedResult.success) {
        return res.status(400).json({ error: parsedResult.error });
    }
    const { email } = parsedResult.data;
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            projects: true
        }
    });
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ status: 'success' });
};

module.exports = { checkUser };