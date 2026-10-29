# Board brief: DevSetu

This brief is the whole idea. Nothing else was stated. Do not invent a budget, a market size, a competitor, a customer-acquisition channel, a guarantee, or a proof that learners get jobs. If a lens needs a number that is not here, name it as an open question.

## The idea

# DevSetu

- What it is: A hands-on technical learning platform where a learner reads, then does the work on a live machine opened in the browser, and can fail without taking a production system down. The focus is systems understanding: how software that holds data, traffic, and state actually behaves, now that language models have made writing code the easy part.
- Who it is for: Developers. Mostly early developers, people switching into this work, and people who are aspirational about learning these systems. Lessons and videos alone are treated as not enough. Also companies: an enterprise package so this can be part of onboarding for their new college graduates (NCGs). The price of that company package is not set.
- What it sells, at what price: Three kinds of work, sold online at https://devsetu.io. The working prices below are the offer. Amounts still shown in the app are not.
  - **Tracks.** Guided paths across engineering disciplines. A learner reads a short lesson, then completes graded exercises on a live machine in the browser. The same shape applies to every engineering track: readings beside the work, a real environment for that discipline, and instant grading. Community access sits with a track. **₹250 to ₹500 per track per month.** Where a track sits in that range depends on the infrastructure it needs. The leaning behind the price is still a wide-audience price: about the cost of serving one learner, plus roughly a 30% margin. That margin is not settled.
  - **Projects.** Longer staged builds (explanation beside a live workspace) that end in a working system: an LSM tree, a B+ tree storage engine, Raft, a small SQL engine, and a key-value store called Cinder. **₹500 per minor per year. ₹750 per major per year.** The first four are minors. Cinder is a major.
  - **Research papers.** Paper of the Month: one landmark paper (the pool is the Google File System, MapReduce, Dynamo, Raft, and Bigtable), short questions with one attempt, answers checked on the server. The follow-on design exercise (the Whiteboard) is switched off. No price.
- Where and how: Online. The public app is https://devsetu.io. Delivery is a sandbox in the browser: learning environments are shared and kept efficient so a student can work on a real machine without their own cloud account. The app host is one EC2 instance (nginx, the API, Postgres, and Redis). Lab machines run on the EKS cluster in `deploy/eks/`. The README does not say how customers find the product.
- Budget and constraints: No budget, runway, or team size is stated. What is already decided: the platform is live; learning stays practical and cheap enough for a wide audience; labs share machines rather than giving each student a cloud account; the product is engineering tracks across disciplines; a track is ₹250 to ₹500 per month depending on infrastructure; a minor is ₹500 per year and a major is ₹750 per year; the Whiteboard is off. What is not decided: the enterprise package price for companies, and whether the margin stays near 30%.

## Facts a stranger needs, and only these

- The product exists and is public at https://devsetu.io.
- Three products sit on one platform: tracks, projects, and research papers (Paper of the Month is on; the Whiteboard follow-on is off and has no price).
- Working prices, which are the offer: a track is ₹250 to ₹500 per month, set by the infrastructure that track needs; a minor project is ₹500 per year; a major project (Cinder) is ₹750 per year. Amounts still shown in the app are not this offer.
- The price leaning is still a wide-audience price: about the cost of serving one learner, plus roughly a 30% margin. Cost to serve one learner is not measured. Whether 30% sticks is not decided.
- Two buyers are named. Individuals: early developers, people switching into this work, and people who are aspirational about learning these systems. Companies: an enterprise package for onboarding new college graduates. No geography, no income, and no split of who pays for an individual learner is given. The company package has no price.
- There is no stated guarantee, no stated proof that learners get jobs or pass interviews, and no stated way the first customers arrive.
- Shared lab machines (not one cloud account per student) are a delivery choice, so a student can work on a real machine without their own cloud account, and so the product can stay cheap enough for a wide audience.
- The stated reason for the product: language models made writing code the easy part, so the remaining scarce skill is understanding systems that hold data, traffic, and state, learned by doing the work rather than watching a lesson.
