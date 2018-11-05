import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function startMigrations() {
    let reader = new UpdateReader('orgs-exporter', 2, DB.Organization);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {

                // id sequence
                let c = await FDB.Sequence.findById('org-id');
                if (!c) {
                    c = await FDB.Sequence.create('org-id', { value: 0 });
                    await c.flush();
                }
                c.value = Math.max(c.value, i.id!);

                // Organization object
                let ex = await FDB.Organization.findById(i.id!);
                let status: 'pending' | 'activated' | 'suspended' = i.status === 'ACTIVATED' ? 'activated' : i.status === 'PENDING' ? 'pending' : 'suspended';
                let kind: 'organization' | 'community' = i.extras && i.extras.isCommunity ? 'community' : 'organization';
                if (!ex) {
                    let members = await DB.OrganizationMember.findAll({ where: { orgId: i.id! } });
                    let owner = members.find((v) => v.isOwner);
                    if (owner) {
                        await FDB.Organization.create(i.id!, { kind, ownerId: owner.userId!, status: status, editorial: i.extras && i.extras.editorial ? true : false });
                    } else {
                        await FDB.Organization.create(i.id!, { kind, ownerId: members[0].userId!, status: status, editorial: i.extras && i.extras.editorial ? true : false });
                    }
                }

                // Profile object
                let exp = await FDB.OrganizationProfile.findById(i.id!);
                if (exp) {
                    exp.name = i.name!;
                    exp.photo = i.photo;
                    exp.about = i.extras && i.extras.about ? i.extras.about! : null;
                    exp.website = i.extras && i.website ? i.website! : null;
                    exp.facebook = i.extras && i.extras.facebook ? i.extras.facebook! : null;
                    exp.twitter = i.extras && i.extras.twitter ? i.extras.twitter! : null;
                    exp.linkedin = i.extras && i.extras.linkedin ? i.extras.linkedin! : null;
                } else {
                    await FDB.OrganizationProfile.create(i.id!, {
                        name: i.name!,
                        photo: i.photo,
                        about: i.extras && i.extras.about ? i.extras.about! : null,
                        website: i.extras && i.website ? i.website! : null,
                        facebook: i.extras && i.extras.facebook ? i.extras.facebook! : null,
                        twitter: i.extras && i.extras.twitter ? i.extras.twitter! : null,
                        linkedin: i.extras && i.extras.linkedin ? i.extras.linkedin! : null
                    });
                }

                // Editorial object
                let exe = await FDB.OrganizationEditorial.findById(i.id!);
                if (exe) {
                    exe.listed = i.extras && i.extras.published ? true : false;
                    exe.featured = i.extras && i.extras.featured ? true : false;
                } else {
                    await FDB.OrganizationEditorial.create(i.id!, {
                        listed: i.extras && i.extras.published ? true : false,
                        featured: i.extras && i.extras.featured ? true : false
                    });
                }
            });
        }
    });
    reader.start();

    let reader2 = new UpdateReader('orgs-members-exporter', 1, DB.OrganizationMember);
    reader2.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                let memb = await FDB.OrganizationMember.findById(i.orgId, i.userId);
                if (memb) {
                    memb.status = 'joined';
                    memb.role = i.isOwner ? 'admin' : 'member';
                } else {
                    await FDB.OrganizationMember.create(i.orgId, i.userId, {
                        role: i.isOwner ? 'admin' : 'member',
                        status: 'joined'
                    });
                }
            });
        }
    });
    reader2.start();
}