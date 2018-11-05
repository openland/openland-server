import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function startMigrator() {
    let reader = new UpdateReader('invites-import', 2, DB.OrganizationInvite);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                if (i.type === 'for_member') {
                    if (!i.isOneTime) {
                        let ex = await FDB.OrganizationPublicInviteLink.findById(i.uuid);
                        if (!ex) {
                            let uid = i.creatorId;
                            if (!uid) {
                                let owner = await DB.OrganizationMember.find({ where: { isOwner: true, orgId: i.orgId } });
                                if (owner) {
                                    uid = owner.userId;
                                }
                            }
                            if (uid) {
                                await FDB.OrganizationPublicInviteLink.create(i.uuid, { oid: i.orgId, enabled: true, uid: uid });
                            }
                        }
                    } else if (i.isOneTime && i.forEmail) {
                        let ex = await FDB.OrganizationInviteLink.findById(i.uuid);
                        if (!ex) {
                            let ttl: number | undefined = undefined;
                            ttl = (typeof i.ttl === 'number') ? i.ttl : undefined;
                            await FDB.OrganizationInviteLink.create(i.uuid, { oid: i.orgId, email: i.forEmail, uid: i.creatorId, firstName: i.memberFirstName, lastName: i.memberLastName, text: i.emailText, enabled: true, joined: !!i.acceptedById, role: i.memberRole as any, ttl: ttl });
                        }
                    }

                }

            });
        }
    });
    reader.start();
}