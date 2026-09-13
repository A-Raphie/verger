# Agents for Humans: Building Verger, the front-desk agent volunteers can trust

Every community organization has one person who runs the inbox at midnight.

A food bank coordinator answering "do you deliver?" for the fortieth time. A residents' association trustee clearing the info@ mailbox on a Sunday. The work is real, it is repetitive, and it happens after everything else is done.

For the AWS Agents for Humans hackathon, I built Verger: a front-desk agent that takes that job, and does it in a way a volunteer can actually trust.

## The rule that shaped everything

The hackathon theme asks for agents that handle repetitive tasks in the background and only surface when there is a real decision to make. That sentence is the whole product.

Verger reads the organization inbox on a schedule, drafts a reply for everything that deserves one, and chases the missing details. And then it does the thing most agent demos skip: it stops.

Every send is a tool call, and a hook in the Strands Agents SDK checks that call against the trustee's policy. Allowlisted recipient? The agent raises an interrupt and pauses the entire run. Nothing goes out until a human reads the draft and clicks approve or deny. The session persists, so the decision can land hours later and the agent resumes exactly where it stopped.

## What shipped

- A live desk at https://vergerdesk.netlify.app with a decision porch (the held drafts), weekly stats, and a receipt ledger
- A scheduled function running unattended rounds every 10 minutes
- A receipt ledger where every action, including reads and denials, is appended to a sha256 hash chain that the agent re-verifies on every write
- A bell that rings exactly once per pending decision. A silent bell is the success state

The whole thing runs on Netlify Functions and Netlify Blobs. No servers, no trial clocks, nothing for a volunteer to maintain.

## What it proved

During testing, the scheduled rounds produced drafts while I slept. One of them was held at the gate because the draft touched a judgment call. That is the moment the product exists for: the AI did the work, and the human made the call.

The demo inbox in the live build is synthetic on purpose. The agent, the gate, and the ledger are the shipped parts.

Live desk: https://vergerdesk.netlify.app
Source (MIT): https://github.com/A-Raphie/verger

Built on the Strands Agents SDK (TypeScript). Two more posts in this series go deeper: one on the interrupt mechanics, one on the receipt chain.

#AWS #StrandsAgents #AIAgents #AgentsforHumans #OpenSource
