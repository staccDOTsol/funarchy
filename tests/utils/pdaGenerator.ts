import * as anchor from '@coral-xyz/anchor';

import {
  Program,
  PublicKey,
} from './metaDAO';

export type AddressAndBump = [PublicKey, number];

export class PDAGenerator {
  program: Program;

  constructor(program: Program) {
    this.program = program;
  }

  generateMetaDAOPDAAddress(): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );
  }

  generateMemberPDAAddress(name: string): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("member"),
        anchor.utils.bytes.utf8.encode(name),
      ],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );
  }

  generateTreasuryPDAAddress(memberAddress: PublicKey): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("treasury"), memberAddress.toBuffer()],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );
  }

  generateConditionalExpressionPDAAddress(
    proposal: PublicKey,
    redeemableOnPass: boolean
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("conditional_expression"),
        proposal.toBuffer(),
        Buffer.from([redeemableOnPass]),
      ],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );
  }

  generateVaultPDAAddress(
    conditionalExpressionAddress: PublicKey,
    underlyingMint: PublicKey
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        conditionalExpressionAddress.toBuffer(),
        underlyingMint.toBuffer(),
      ],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );
  }

  generateDepositSlipPDAAddress(
    conditionalVault: PublicKey,
    user: PublicKey
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("deposit_slip"),
        conditionalVault.toBuffer(),
        user.toBuffer(),
      ],
      new PublicKey("62BiVvL2o3dHYbSAjh1ywDTqC9rm7j9eg2PoRSSG9nEH")
    );
  }
}
