const { PrismaClient } = require('@prisma/client');
const { generateSlug } = require('random-word-slugs');
const { z } = require('zod');
const prisma = new PrismaClient();

const createProject = async (req, res) => {
  const schema = z.object({
    name: z.string(),
    git_url: z.string().url(),
  });
  const parsedResult = schema.safeParse(req.body);
  if (!parsedResult.success) {
    return res.status(400).json({ error: parsedResult.error });
  }
  const { name, git_url } = parsedResult.data;
  const project = await prisma.project.create({
    data: { name, git_url, subdomain: generateSlug() },
  });
  res.json({ status: 'success', data: { project } });
};

module.exports = { createProject };
